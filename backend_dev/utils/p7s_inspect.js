#!/usr/bin/env node
/*
 Simple inspector for .p7s files used by leitura-livros.
 Usage: node utils/p7s_inspect.js "C:\\path\\to\\file.p7s"
 Prints whether payload is embedded and its detected type.
*/

const fs = require('fs');
const path = require('path');

function detectContentType(buf) {
  if (!buf || buf.length < 4) return { type: 'unknown', ext: '' };
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return { type: 'pdf', ext: '.pdf' }; // %PDF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return { type: 'image', ext: '.jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return { type: 'image', ext: '.png' };
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) || (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A)) return { type: 'image', ext: '.tiff' };
  return { type: 'unknown', ext: '' };
}

async function extractP7sPayload(buf) {
  const forge = require('node-forge');
  try {
    let derBuf = buf;
    const ascii = buf.toString('utf8');
    if (/-----BEGIN/i.test(ascii)) {
      const pem = ascii.replace(/\r/g, '').trim();
      let b64 = pem.replace(/-----BEGIN[^-]+-----/g, '').replace(/-----END[^-]+-----/g, '').replace(/\n/g, '');
      derBuf = Buffer.from(b64, 'base64');
      console.log('[info] Detected PEM format; converted to DER');
    }
    let asn1;
    try { asn1 = forge.asn1.fromDer(derBuf.toString('binary')); }
    catch (_) {
      try {
        const maybeB64 = ascii.replace(/\s+/g, '');
        const tryBuf = Buffer.from(maybeB64, 'base64');
        asn1 = forge.asn1.fromDer(tryBuf.toString('binary'));
        console.log('[info] Detected base64-only content; decoded to DER');
      } catch (e2) {
        throw new Error('Not DER/PEM/base64 recognizable as PKCS#7');
      }
    }
    const p7 = forge.pkcs7.messageFromAsn1(asn1);
    let contentBuf = null;
    if (p7 && p7.rawCapture) {
      if (p7.rawCapture.content) {
        try { contentBuf = Buffer.from(p7.rawCapture.content, 'binary'); } catch {}
      }
      if ((!contentBuf || contentBuf.length === 0) && p7.rawCapture.eContent) {
        try { contentBuf = Buffer.from(p7.rawCapture.eContent, 'binary'); } catch {}
      }
    }
    if (!contentBuf || contentBuf.length === 0) {
      const asn1Mod = forge.asn1;
      function findOctetString(node) {
        if (!node) return null;
        if (node.tagClass === asn1Mod.Class.CONTEXT_SPECIFIC && node.type === 0) {
          if (node.constructed && Array.isArray(node.value)) {
            for (const child of node.value) {
              const found = findOctetString(child);
              if (found) return found;
            }
          }
        }
        if (node.tagClass === asn1Mod.Class.UNIVERSAL && node.type === asn1Mod.Type.OCTETSTRING) {
          if (node.constructed && Array.isArray(node.value)) {
            let acc = '';
            for (const part of node.value) {
              const inner = findOctetString(part);
              if (inner && inner.length) acc += inner.toString('binary');
            }
            return Buffer.from(acc, 'binary');
          }
          return Buffer.from(node.value, 'binary');
        }
        if (Array.isArray(node.value)) {
          for (const child of node.value) {
            const found = findOctetString(child);
            if (found) return found;
          }
        }
        return null;
      }
      const possible = findOctetString(asn1);
      if (possible && possible.length) contentBuf = possible;
    }
    if (!contentBuf || contentBuf.length === 0) {
      const mags = [
        { sig: Buffer.from([0x25,0x50,0x44,0x46]) },
        { sig: Buffer.from([0xFF,0xD8,0xFF]) },
        { sig: Buffer.from([0x89,0x50,0x4E,0x47]) },
        { sig: Buffer.from([0x49,0x49,0x2A,0x00]) },
        { sig: Buffer.from([0x4D,0x4D,0x00,0x2A]) },
      ];
      let bestIdx = -1;
      for (const m of mags) {
        const idx = derBuf.indexOf(m.sig);
        if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
      }
      if (bestIdx !== -1) contentBuf = Buffer.from(derBuf.slice(bestIdx));
    }
    if (!contentBuf || contentBuf.length === 0) return { buffer: null };
    return { buffer: contentBuf };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

function findPairForDetachedP7s(p7sPath) {
  const dir = path.dirname(p7sPath);
  const name = path.basename(p7sPath).toLowerCase();
  const tryNames = [];
  if (name.endsWith('.pdf.p7s')) {
    const base = name.slice(0, -('.pdf.p7s'.length));
    tryNames.push(base + '.pdf');
  }
  if (name.endsWith('.p7s')) {
    const base = name.slice(0, -('.p7s'.length));
    ['.pdf', '.jpg', '.jpeg', '.png', '.tif', '.tiff'].forEach(ext => tryNames.push(base + ext));
  }
  try {
    const entries = fs.readdirSync(dir);
    for (const e of entries) {
      if (tryNames.includes(e.toLowerCase())) return path.join(dir, e);
    }
  } catch {}
  return null;
}

(async () => {
  const p7sPath = process.argv[2];
  if (!p7sPath) {
    console.error('Usage: node utils/p7s_inspect.js "C:\\path\\to\\file.p7s"');
    process.exit(2);
  }
  if (!fs.existsSync(p7sPath)) {
    console.error('[error] File not found:', p7sPath);
    process.exit(1);
  }
  const buf = fs.readFileSync(p7sPath);
  const res = await extractP7sPayload(buf);
  if (res.error) {
    console.error('[error] Failed to parse PKCS#7:', res.error);
    process.exit(1);
  }
  if (!res.buffer) {
    console.log('[warning] Detached signature: no embedded payload');
    const pair = findPairForDetachedP7s(p7sPath);
    if (pair) {
      console.log('[info] Found candidate original file:', pair);
    } else {
      console.log('[warning] No pair found in directory. Upload with the same basename as the .p7s');
    }
    process.exit(0);
  }
  console.log('[success] Embedded payload found. Bytes:', res.buffer.length);
  const det = detectContentType(res.buffer);
  console.log('[info] Detected type:', det.type, det.ext || '(unknown extension)');
})();
