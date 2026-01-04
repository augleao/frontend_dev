#!/usr/bin/env python3
"""
scripts/update_b2_cors.py

Use the Backblaze B2 native API to update bucket CORS rules.
Usage (PowerShell):

# set env vars for one-off run in current shell
# $env:B2_ACCOUNT_ID='005d320f21b26310000000002'
# $env:B2_APPLICATION_KEY='YOUR_APPLICATION_KEY'
# $env:B2_BUCKET_ID='7d7322401f62914b92a60311'
# $env:FRONTEND_ORIGIN='https://frontend-dev-e7yt.onrender.com'
# py -3 ./scripts/update_b2_cors.py

This script will:
- call b2_authorize_account to get apiUrl and auth token
- call b2_update_bucket supplying a `corsRules` array

WARNING: Do NOT commit keys to source control. Use environment variables or a secret store.
"""

import os
import sys
import requests
import json
import shutil
import subprocess


def fail(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def main():
    account_id = os.environ.get('B2_ACCOUNT_ID')
    application_key_id = os.environ.get('B2_APPLICATION_KEY_ID')
    application_key = os.environ.get('B2_APPLICATION_KEY')
    bucket_id = os.environ.get('B2_BUCKET_ID')
    # Allow comma-separated list of origins in FRONTEND_ORIGINS or single FRONTEND_ORIGIN
    frontend_origins_env = os.environ.get('FRONTEND_ORIGINS') or os.environ.get('FRONTEND_ORIGIN') or 'https://frontend-dev-e7yt.onrender.com'
    frontend_origins = [o.strip() for o in frontend_origins_env.split(',') if o.strip()]
    # Optional: explicit path to b2 CLI executable
    b2_cli_path = os.environ.get('B2_CLI_PATH')

    if not application_key or not bucket_id:
        fail('Missing env vars. Set B2_APPLICATION_KEY and B2_BUCKET_ID (and optionally B2_APPLICATION_KEY_ID/B2_ACCOUNT_ID).')

    cors_rule = {
        "corsRuleName": "s3UploadFromFrontend",
        "allowedOrigins": frontend_origins,
        "allowedHeaders": ["*"],
        "allowedOperations": ["s3_put", "s3_head", "s3_get"],
        "exposeHeaders": ["ETag", "x-amz-request-id", "x-amz-id-2"],
        "maxAgeSeconds": 3600
    }

    # Try CLI first if available (either provided path or detect common locations)
    if b2_cli_path:
        cli = b2_cli_path
    else:
        default_cli = os.path.join(os.environ.get('APPDATA', ''), 'Python', 'Python313', 'Scripts', 'b2.exe')
        cli = default_cli if os.path.exists(default_cli) else shutil.which('b2')

    if cli:
        print(f'Using b2 CLI at: {cli}')
        try:
            # Try modern form: `b2 account authorize <applicationKeyId> <applicationKey>` when we have the key id
            if application_key_id:
                proc = subprocess.run([cli, 'account', 'authorize', application_key_id, application_key], capture_output=True, text=True)
            else:
                proc = subprocess.run([cli, 'account', 'authorize'], capture_output=True, text=True)

            if proc.returncode != 0:
                # Fallback to deprecated invocation if present (try using key id if we have it)
                if application_key_id:
                    proc = subprocess.run([cli, 'authorize-account', application_key_id, application_key], capture_output=True, text=True)
                else:
                    proc = subprocess.run([cli, 'authorize-account'], capture_output=True, text=True)

            if proc.returncode != 0:
                print('CLI authorize failed (or skipped). CLI stderr:')
                print(proc.stderr.strip())
            else:
                print('CLI authorize OK')

            # Regardless of whether authorize succeeded, try to use the CLI (it may have cached credentials)
            try:
                list_proc = subprocess.run([cli, 'bucket', 'list', '--json'], capture_output=True, text=True)
                bucket_name = None
                if list_proc.returncode == 0:
                    try:
                        buckets = json.loads(list_proc.stdout)
                        for b in buckets:
                            if str(b.get('bucketId')) == str(bucket_id) or b.get('bucketId') == bucket_id:
                                bucket_name = b.get('bucketName')
                                break
                    except Exception:
                        bucket_name = None

                cors_payload = json.dumps([cors_rule])
                tried_cmds = []

                # Try modern bucket update forms using bucket name when available
                if bucket_name:
                    cmd = [cli, 'bucket', 'update', '--cors-rules', cors_payload, bucket_name]
                    tried_cmds.append(cmd)
                    proc2 = subprocess.run(cmd, capture_output=True, text=True)
                    if proc2.returncode == 0:
                        print('CLI bucket update succeeded')
                        print(proc2.stdout)
                        print('\nDone. Changes may take a few minutes to propagate.')
                        return

                    # try alternate ordering
                    cmd = [cli, 'bucket', 'update', bucket_name, '--cors-rules', cors_payload]
                    tried_cmds.append(cmd)
                    proc2 = subprocess.run(cmd, capture_output=True, text=True)
                    if proc2.returncode == 0:
                        print('CLI bucket update succeeded (alternate order)')
                        print(proc2.stdout)
                        print('\nDone. Changes may take a few minutes to propagate.')
                        return

                # Try deprecated direct command forms (bucketName required)
                if bucket_name:
                    cmd = [cli, 'update-bucket', bucket_name, '--cors-rules', cors_payload]
                    tried_cmds.append(cmd)
                    proc2 = subprocess.run(cmd, capture_output=True, text=True)
                    if proc2.returncode == 0:
                        print('CLI update-bucket succeeded (deprecated form)')
                        print(proc2.stdout)
                        print('\nDone. Changes may take a few minutes to propagate.')
                        return

                # As a last resort, try giving bucketId directly with deprecated update-bucket (some CLI versions expect bucketId)
                cmd = [cli, 'update-bucket', '--bucketId', bucket_id, '--cors-rules', cors_payload]
                tried_cmds.append(cmd)
                proc2 = subprocess.run(cmd, capture_output=True, text=True)
                if proc2.returncode == 0:
                    print('CLI update-bucket succeeded (with --bucketId)')
                    print(proc2.stdout)
                    print('\nDone. Changes may take a few minutes to propagate.')
                    return

                # If still failing, print info and fall back to HTTP API
                print('CLI update attempts failed, will fall back to HTTP API. Commands tried:')
                for c in tried_cmds:
                    print(' ', ' '.join(c))
                if 'proc2' in locals():
                    print('Last CLI stderr:')
                    print(proc2.stderr.strip())
            except Exception as e:
                print('Error while using b2 CLI:', e)
        except FileNotFoundError:
            print('b2 CLI not found at', cli)
        except Exception as e:
            print(f'Error running b2 CLI: {e}')

    # Fallback: use native HTTP API
    # If we have a CLI available and the provided account_id looks short/incorrect,
    # try to read the full accountId from the CLI's account info.
    if cli and (not account_id or not str(account_id).startswith('00')):
        try:
            # Try JSON output first (some CLI versions support --json)
            acct_proc = subprocess.run([cli, 'account', 'get', '--json'], capture_output=True, text=True)
            acct_id_cli = None
            if acct_proc.returncode == 0:
                try:
                    acct = json.loads(acct_proc.stdout)
                    acct_id_cli = acct.get('accountId') or acct.get('account_id')
                except Exception:
                    acct_id_cli = None

            # Fallback: some CLI versions don't accept --json; run plain 'account get' and parse
            if not acct_id_cli:
                acct_proc2 = subprocess.run([cli, 'account', 'get'], capture_output=True, text=True)
                if acct_proc2.returncode == 0:
                    out = acct_proc2.stdout + '\n' + acct_proc2.stderr
                    # Look for patterns like 'accountId: 00...' or 'Account ID: 00...'
                    import re
                    m = re.search(r"account[_ ]?id[:\s]+(00[0-9a-zA-Z]+)", out, flags=re.IGNORECASE)
                    if m:
                        acct_id_cli = m.group(1).strip()

            if acct_id_cli:
                print(f'Using accountId from b2 CLI: {acct_id_cli}')
                account_id = acct_id_cli
        except Exception:
            pass

    auth_url = 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account'
    print('Authorizing with B2 (HTTP API)...')
    # Use applicationKeyId + applicationKey for HTTP Basic auth when available
    http_auth_user = application_key_id if application_key_id else account_id
    if not http_auth_user:
        fail('Missing application key id (set B2_APPLICATION_KEY_ID) or ensure b2 CLI has cached credentials.')
    resp = requests.get(auth_url, auth=(http_auth_user, application_key))
    if resp.status_code != 200:
        fail(f'Authorization failed: {resp.status_code} {resp.text}')
    auth = resp.json()
    api_url = auth.get('apiUrl')
    if not api_url:
        fail('Missing apiUrl in authorization response')
    auth_token = auth.get('authorizationToken')

    update_url = api_url.rstrip('/') + '/b2api/v2/b2_update_bucket'

    payload = {
        "accountId": account_id,
        "bucketId": bucket_id,
        "corsRules": [cors_rule]
    }

    headers = {
        'Authorization': auth_token,
        'Content-Type': 'application/json'
    }

    print('Updating bucket CORS via native B2 API...')
    r = requests.post(update_url, headers=headers, data=json.dumps(payload))
    if r.status_code != 200:
        fail(f'Update failed: {r.status_code} {r.text}')

    print('Update response:')
    print(json.dumps(r.json(), indent=2))
    print('\nDone. Changes may take a few minutes to propagate.')


if __name__ == '__main__':
    main()
