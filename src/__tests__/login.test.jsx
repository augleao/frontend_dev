import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../Login';
import config from '../config';

jest.mock('../utils/tracker', () => ({ trackEvent: jest.fn(), getUid: () => 'local-uid' }));

describe('Login component', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('sends JSON body { nome, password } to config.apiURL/login with credentials', async () => {
    const fakeResponse = {
      ok: true,
      json: () => Promise.resolve({ user: { id: 1 }, token: 'tok' }),
      headers: new Map([['set-cookie', 'track_uid=abc; HttpOnly; SameSite=Lax']])
    };

    global.fetch = jest.fn((url, opts) => {
      if (url === `${config.apiURL}/login`) return Promise.resolve(fakeResponse);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/Digite seu nome/i), { target: { value: 'Augusto' } });
    fireEvent.change(screen.getByPlaceholderText(/Digite sua senha/i), { target: { value: 'senha123' } });
    fireEvent.click(screen.getByText(/Entrar/i));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const called = global.fetch.mock.calls.find(c => c[0] === `${config.apiURL}/login`);
    expect(called).toBeDefined();
    const opts = called[1];

    // Body should be JSON with nome and password
    expect(opts.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({ nome: 'Augusto', password: 'senha123' });

    // credentials should be present so Set-Cookie from server can be applied
    expect(opts.credentials).toBe('include');
  });
});
