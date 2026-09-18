import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';

const m = vi.hoisted(() => ({
  callbackUrl: 'http://localhost:3001/api/connections/youtube/callback',
  results: [] as unknown[][], inserted: [] as Record<string, unknown>[],
  verify: vi.fn(), getToken: vi.fn(), channel: vi.fn(), revoke: vi.fn(),
}));
vi.mock('../src/config/env.js', () => ({ env: {
  YOUTUBE_CLIENT_ID: 'id', YOUTUBE_CLIENT_SECRET: 'secret', CONNECTION_ENCRYPTION_KEY: 'ab'.repeat(32),
  get YOUTUBE_CALLBACK_URL() { return m.callbackUrl; },
} }));
vi.mock('../src/core/engine.js', () => ({ engine: { invalidateAccount: vi.fn() } }));
vi.mock('../src/core/account-scheduler.js', () => ({ syncAccountCrons: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/platforms/youtube/connection.js', () => ({
  YOUTUBE_SCOPES: ['upload', 'readonly'], verifyYouTube: m.verify,
  connectedClient: async () => ({ revokeCredentials: m.revoke }),
  oauthClient: () => ({
    generateCodeVerifierAsync: async () => ({ codeVerifier: 'verifier', codeChallenge: 'challenge' }),
    generateAuthUrl: (options: Record<string, unknown>) => 'https://accounts.google.com/auth?' + new URLSearchParams(options as Record<string, string>),
    getToken: m.getToken, setCredentials: vi.fn(),
  }),
}));
vi.mock('googleapis', () => ({ google: { youtube: () => ({ channels: { list: m.channel } }) } }));
vi.mock('../src/db/index.js', async () => {
  const schema = await import('../src/db/schema/index.js');
  const builder = () => {
    const b = {
      from: () => b, where: () => b, limit: async () => m.results.shift() || [],
      returning: async () => m.results.shift() || [],
      values: (v: Record<string, unknown>) => { m.inserted.push(v); return b; },
      set: () => b, onConflictDoUpdate: async () => undefined,
      then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(resolve([])),
    };
    return b;
  };
  const db = { select: builder, insert: builder, delete: builder, update: builder, execute: async () => [], transaction: async (fn: (tx: unknown) => unknown) => fn(db) };
  return { schema, db };
});
import { connectionsRouter } from '../src/server/routes/connections.js';

describe('Connected Platforms OAuth routes', () => {
  let server: Server;
  let origin: string;
  const projectId = '4f7a3b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const accountId = '5f7a3b8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  beforeAll(async () => {
    const app = express(); app.use(express.json()); app.use('/api/connections', connectionsRouter);
    server = await new Promise<Server>(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
    m.callbackUrl = origin + '/api/connections/youtube/callback';
  });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); });
  beforeEach(() => {
    m.results.length = 0; m.inserted.length = 0; vi.clearAllMocks();
    m.getToken.mockResolvedValue({ tokens: { refresh_token: 'private', access_token: 'private-access', scope: 'upload readonly' } });
    m.channel.mockResolvedValue({ data: { items: [{ id: 'channel', snippet: { title: 'My channel' } }] } });
  });
  const post = (path: string, body: object = {}) => fetch(origin + '/api/connections' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'DailyPost', Origin: origin }, body: JSON.stringify(body) });
  const callback = () => fetch(origin + '/api/connections/youtube/callback?state=one-time&code=code', { headers: { Cookie: 'daily_post_oauth=browser' }, redirect: 'manual' });
  it('rejects cross-origin and form-based mutations', async () => {
    expect((await fetch(origin + '/api/connections/youtube/connect', { method: 'POST' })).status).toBe(403);
    expect((await fetch(origin + '/api/connections/youtube/connect', { method: 'POST', headers: { 'X-Requested-With': 'DailyPost', Origin: 'https://attacker.example' } })).status).toBe(403);
  });
  it('validates project IDs', async () => { expect((await post('/youtube/connect', { projectId: 'bad' })).status).toBe(400); });
  it('rejects a different dashboard host before setting an OAuth cookie', async () => {
    const correct = m.callbackUrl;
    m.callbackUrl = 'http://localhost:3001/api/connections/youtube/callback';
    try {
      const response = await post('/youtube/connect', { projectId, accountId });
      expect(response.status).toBe(409);
      const data = await response.json() as { redirectUrl: string };
      expect(data.redirectUrl).toBe('http://localhost:3001/#settings');
      expect(response.headers.get('set-cookie')).toBeNull();
    } finally { m.callbackUrl = correct; }
  });
  it('starts offline OAuth with PKCE and a browser-bound session', async () => {
    m.results.push([{ id: projectId }], [{ id: accountId }]);
    const response = await post('/youtube/connect', { projectId, accountId });
    expect(response.status).toBe(200);
    const data = await response.json() as { url: string };
    const url = new URL(data.url);
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('code_challenge')).toBe('challenge');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(m.inserted[0]).toMatchObject({ accountId, verifier: 'verifier' });
    expect(m.inserted[0]!.state).not.toBe(url.searchParams.get('state'));
  });
  it('rejects callbacks without the initiating browser cookie', async () => {
    const r = await fetch(origin + '/api/connections/youtube/callback?state=state&code=code');
    expect(r.status).toBe(400); expect(m.getToken).not.toHaveBeenCalled();
  });
  it('rejects expired, replayed and mismatched sessions', async () => {
    expect((await callback()).status).toBe(400); expect(m.getToken).not.toHaveBeenCalled();
  });
  it('exchanges the code, verifies the channel and stores encrypted tokens', async () => {
    m.results.push([{ accountId, verifier: 'verifier' }], [{ accountId }]);
    const r = await callback();
    expect(r.headers.get('location')).toContain('connection=connected');
    expect(m.getToken).toHaveBeenCalledWith({ code: 'code', codeVerifier: 'verifier' });
    expect(m.inserted[0]).toMatchObject({ accountId, externalId: 'channel', status: 'connected' });
    expect(m.inserted[0]!.tokens).not.toContain('private');
  });
  it('rejects missing refresh permission without storing credentials', async () => {
    m.results.push([{ accountId, verifier: 'verifier' }]);
    m.getToken.mockResolvedValueOnce({ tokens: { access_token: 'access', scope: 'upload readonly' } });
    expect((await callback()).headers.get('location')).toContain('connection=failed');
    expect(m.inserted).toEqual([]);
  });
  it('rejects a callback whose session was removed during authorization', async () => {
    m.results.push([{ accountId, verifier: 'verifier' }], []);
    expect((await callback()).headers.get('location')).toContain('connection=failed');
    expect(m.inserted).toEqual([]);
  });
  it('handles denied consent without exchanging tokens', async () => {
    m.results.push([{ accountId, verifier: 'verifier' }]);
    const r = await fetch(origin + '/api/connections/youtube/callback?state=one-time&error=access_denied', { headers: { Cookie: 'daily_post_oauth=browser' }, redirect: 'manual' });
    expect(r.headers.get('location')).toContain('connection=cancelled');
    expect(m.getToken).not.toHaveBeenCalled();
  });
  it('rejects partial permission grants', async () => {
    m.results.push([{ accountId, verifier: 'verifier' }]);
    m.getToken.mockResolvedValueOnce({ tokens: { refresh_token: 'grant', scope: 'readonly' } });
    expect((await callback()).headers.get('location')).toContain('connection=failed');
    expect(m.channel).not.toHaveBeenCalled();
  });
  it('disconnects even when provider revocation fails', async () => {
    m.results.push([{ id: accountId, platform: 'youtube' }]);
    m.revoke.mockRejectedValueOnce(new Error('network outage'));
    const r = await post('/' + accountId + '/disconnect');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'disconnected', revoked: false });
  });
  it('reports verification failure without exposing provider errors', async () => {
    m.verify.mockRejectedValueOnce(new Error('private provider details'));
    const r = await post('/' + accountId + '/verify');
    expect(r.status).toBe(409);
    expect(await r.text()).not.toContain('private');
  });
});
