/* Minimal frontend tracker utilities.
   - Respects Do Not Track
   - Uses localStorage for a pseudonymous id
   - Sends anonymous payloads to backend endpoint '/api/tracker/events'
   - This file does NOT send any personal data; implement server-side anonymization/retention.
*/

import config from '../config';

const CONSENT_KEY = 'biblio_consent';
const UID_KEY = 'biblio_uid';

function doNotTrackEnabled() {
  try {
    const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return dnt === '1' || dnt === 'yes';
  } catch (e) {
    return false;
  }
}

function genUid() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function isConsentGiven() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function initTracker() {
  if (doNotTrackEnabled()) return;
  if (!isConsentGiven()) return;
  try {
    let uid = localStorage.getItem(UID_KEY);
    if (!uid) {
      uid = genUid();
      localStorage.setItem(UID_KEY, uid);
    }
  } catch (e) {
    // ignore
  }
}

export async function trackEvent(name, data = {}) {
  if (doNotTrackEnabled()) return;
  if (!isConsentGiven()) return;
  const payload = {
    event: name,
    path: window.location.pathname,
    ts: new Date().toISOString(),
    data: data || {}
  };

  // ensure UID is present when available (helps cross-origin/beacon cases)
  try {
    const localUid = getUid();
    if (localUid && (!payload.data || !payload.data.uid)) {
      payload.data = payload.data || {};
      payload.data.uid = payload.data.uid || localUid;
    }
  } catch (e) {}

  // Log payload in devtools for login events to aid debugging
  try {
    if (typeof name === 'string' && name.toLowerCase().includes('login')) {
      console.debug('tracker payload', payload);
    }
  } catch (e) {
    // ignore logging errors
  }
  // Best-effort fire-and-forget; backend should read cookie (e.g. track_uid)
  console.debug('[tracker] send', payload);
  try {
    const url = `${config.apiURL}/tracker/events`;
    if (navigator.sendBeacon && typeof navigator.sendBeacon === 'function') {
      try {
        // Use a Blob with explicit JSON mime type so servers see application/json
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const ok = navigator.sendBeacon(url, blob);
        if (!ok) {
          // fallback to fetch if sendBeacon returns false
          fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {});
        }
      } catch (e) {
        // if sendBeacon fails, fall back to fetch
        fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    } else {
      fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch (e) {
    // swallow errors
  }
}

export function getUid() {
  try { return localStorage.getItem(UID_KEY); } catch(e){ return null; }
}
