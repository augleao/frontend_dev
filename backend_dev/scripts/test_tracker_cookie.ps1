# Test tracker cookies (PowerShell)
# Usage: .\test_tracker_cookie.ps1 -BaseUrl "http://localhost:3001"
param(
    [string]$BaseUrl = "http://localhost:3001",
    [string]$Email = "user@example.com",
    [string]$Password = "senha"
)

# Files
$cookieJar = "$PSScriptRoot\tracker_cookies.txt"
if (Test-Path $cookieJar) { Remove-Item $cookieJar }

Write-Host "1) Login -> obtain Set-Cookie"
$loginUrl = "$BaseUrl/api/auth/login"
$loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json

# Use curl to store cookies in cookieJar
$loginCmd = "curl -i -X POST `"$loginUrl`" -H 'Content-Type: application/json' -d '$loginBody' --cookie-jar `"$cookieJar`""
Write-Host $loginCmd
Invoke-Expression $loginCmd

Write-Host "`n2) Show stored cookies file:`n"
if (Test-Path $cookieJar) { Get-Content $cookieJar | Write-Host } else { Write-Host "No cookies saved." }

Write-Host "`n3) Send tracker event using saved cookie"
$eventUrl = "$BaseUrl/api/tracker/events"
$eventBody = '{"event":"test_event","path":"/test","ts":"' + (Get-Date).ToString('o') + '","data":{"test":true}}'
$postCmd = "curl -i -X POST `"$eventUrl`" -H 'Content-Type: application/json' -d '$eventBody' --cookie `"$cookieJar`""
Write-Host $postCmd
Invoke-Expression $postCmd

Write-Host "`nDone. Check server logs and DB for inserted tracker_events."