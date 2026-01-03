import { trackEvent } from '../utils/tracker';
import config from '../config';

describe('tracker utilities', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('uses navigator.sendBeacon when available (same-origin)', () => {
    global.navigator.sendBeacon = jest.fn(() => true);
    global.fetch = jest.fn();

    trackEvent('test-event', { foo: 'bar' });

    expect(global.navigator.sendBeacon).toHaveBeenCalledWith(`${config.apiURL}/tracker/events`, expect.any(String));
    // should not call fetch when sendBeacon is used
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('falls back to fetch with credentials: include when sendBeacon missing', async () => {
    global.navigator.sendBeacon = undefined;
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));

    await trackEvent('test-event-2', { uid: 'abc' });

    expect(global.fetch).toHaveBeenCalled();
    const calledWith = global.fetch.mock.calls[0];
    const url = calledWith[0];
    const opts = calledWith[1];

    expect(url).toBe(`${config.apiURL}/tracker/events`);
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
    const payload = JSON.parse(opts.body);
    expect(payload).toHaveProperty('event', 'test-event-2');
    expect(payload).toHaveProperty('path');
    expect(payload).toHaveProperty('ts');
    expect(payload.data).toMatchObject({ uid: 'abc' });
  });
});
