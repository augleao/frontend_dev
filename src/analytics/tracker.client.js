// Tracker client example - minimal, framework-agnostic
// Usage: import or include in a bundle and call Tracker.init({ endpoint })

class Tracker {
  constructor() {
    this.endpoint = null;
    this.clientVersion = null;
    this.queue = [];
    this.flushInterval = 5000; // ms
    this.batchSize = 20;
    this.sessionId = this._getOrCreateSessionId();
    this.sequence = 0;
    this.timer = null;
  }

  init({ endpoint, clientVersion }) {
    this.endpoint = endpoint || '/api/tracker/events';
    this.clientVersion = clientVersion || 'unknown';
    this._startTimer();
    window.addEventListener('beforeunload', () => this._flushOnUnload());
    window.addEventListener('unhandledrejection', (e) => this.track('error', { message: String(e.reason) }));
    window.addEventListener('error', (e) => this.track('error', { message: e.message, filename: e.filename, lineno: e.lineno }));
  }

  _getOrCreateSessionId() {
    try {
      const key = 'analytic_session_id';
      let s = localStorage.getItem(key);
      if (!s) {
        s = 'sess-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(key, s);
      }
      return s;
    } catch (err) {
      return 'sess-unknown';
    }
  }

  track(eventType, metadata = {}) {
    const evt = this._buildEvent(eventType, metadata);
    this.queue.push(evt);
    if (this.queue.length >= this.batchSize) this._flush();
  }

  _buildEvent(eventType, metadata) {
    this.sequence += 1;
    return {
      eventType,
      eventId: this._uuidv4(),
      userId: window.__CURRENT_USER_ID || null,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer || null,
      clientVersion: this.clientVersion,
      sequence: this.sequence,
      metadata,
    };
  }

  _startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this._flush(), this.flushInterval);
  }

  _flush() {
    if (!this.endpoint) return;
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.batchSize);
    this._sendBatch(batch).catch((err) => {
      // On error, requeue with simple retry strategy
      this.queue = batch.concat(this.queue);
    });
  }

  async _sendBatch(batch) {
    // Map internal event shape to backend expected shape
    const mapped = batch.map((evt) => ({
      // prefer a stable user identifier; fallback to sessionId to avoid backend 400 when anonymous disallowed
      uid: evt.userId || evt.sessionId || null,
      event: evt.eventType,
      path: evt.url || (evt.metadata && evt.metadata.route) || null,
      ts: evt.timestamp,
      data: {
        sessionId: evt.sessionId,
        eventId: evt.eventId,
        metadata: evt.metadata || null,
        clientVersion: evt.clientVersion,
        sequence: evt.sequence,
        referrer: evt.referrer || null,
      },
    }));
    const payload = JSON.stringify({ events: mapped });
    // prefer sendBeacon for reliability on unload
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const ok = navigator.sendBeacon(this.endpoint, blob);
      if (ok) return;
    }
    // fallback to fetch
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    });
    if (!res.ok) throw new Error('failed to send analytics');
  }

  _flushOnUnload() {
    if (this.queue.length === 0) return;
    const mapped = this.queue.map((evt) => ({
      uid: evt.userId || evt.sessionId || null,
      event: evt.eventType,
      path: evt.url || (evt.metadata && evt.metadata.route) || null,
      ts: evt.timestamp,
      data: {
        sessionId: evt.sessionId,
        eventId: evt.eventId,
        metadata: evt.metadata || null,
        clientVersion: evt.clientVersion,
        sequence: evt.sequence,
        referrer: evt.referrer || null,
      },
    }));
    const payload = JSON.stringify({ events: mapped });
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(this.endpoint, blob);
      this.queue = [];
    } else {
      // best-effort synchronous XHR fallback (deprecated but may help)
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.endpoint, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(payload);
        this.queue = [];
      } catch (err) {
        // swallow
      }
    }
  }

  _uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

// Export singleton
const tracker = new Tracker();
export default tracker;

/*
Usage examples:

import tracker from 'src/analytics/tracker.client.js';
tracker.init({ endpoint: '/api/analytics/ingest', clientVersion: 'frontend@1.2.3' });

// track page view on router change (React Router example):
// import { useEffect } from 'react';
// const location = useLocation();
// useEffect(() => {
//   tracker.track('page_view', { route: location.pathname });
// }, [location]);

// track clicks by adding data-track attribute:
// document.addEventListener('click', (e) => {
//   const el = e.target.closest('[data-track]');
//   if (el) tracker.track('click', { selector: el.tagName.toLowerCase(), dataset: el.dataset });
// });
*/