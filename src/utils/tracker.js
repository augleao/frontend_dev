/* Minimal frontend tracker utilities.
   - Respects Do Not Track
   - Uses localStorage for a pseudonymous id
   - Sends anonymous payloads to backend endpoint '/api/tracker/events'
   - This file does NOT send any personal data; implement server-side anonymization/retention.
*/

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
  let uid;
  try {
    uid = localStorage.getItem(UID_KEY) || null;
  } catch (e) {
    uid = null;
  }

  const payload = {
    uid,
    event: name,
    path: window.location.pathname,
    ts: new Date().toISOString(),
    data
  };

  // Best-effort fire-and-forget; backend should validate and anonymize
  try {
    navigator.sendBeacon && typeof navigator.sendBeacon === 'function'
      ? navigator.sendBeacon('/api/tracker/events', JSON.stringify(payload))
      : fetch('/api/tracker/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
  } catch (e) {
    // swallow errors
  }
}

export function getUid() {
  try { return localStorage.getItem(UID_KEY); } catch(e){ return null; }
}
