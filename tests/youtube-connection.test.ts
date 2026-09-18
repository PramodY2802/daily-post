import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptTokens, decryptTokens } from '../src/core/connection-crypto.js';

const mocks = vi.hoisted(() => ({
  row: undefined as undefined | { tokens: string; status: string },
  writes: [] as Record<string, unknown>[],
  refresh: vi.fn(), channels: vi.fn(),
  credentials: {} as Record<string, unknown>,
}));
vi.mock('../src/config/env.js', () => ({ env: {
  YOUTUBE_CLIENT_ID: 'app-id', YOUTUBE_CLIENT_SECRET: 'app-secret',
  YOUTUBE_CALLBACK_URL: 'http://localhost:3001/api/connections/youtube/callback',
  CONNECTION_ENCRYPTION_KEY: 'ab'.repeat(32),
} }));
vi.mock('../src/db/index.js', async () => {
  const schema = await import('../src/db/schema/index.js');
  return { schema, db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.row ? [mocks.row] : [] }) }) }),
    update: () => ({ set: (value: Record<string, unknown>) => ({ where: async () => { mocks.writes.push(value); } }) }),
  } };
});
vi.mock('googleapis', () => ({ google: {
  auth: { OAuth2: class {
    credentials = mocks.credentials;
    setCredentials(tokens: Record<string, unknown>) { this.credentials = { ...tokens }; }
    async getAccessToken() { const value = await mocks.refresh(); Object.assign(this.credentials, value); }
  } },
  youtube: () => ({ channels: { list: mocks.channels } }),
} }));

import { connectedClient, verifyYouTube, isAuthorizationError } from '../src/platforms/youtube/connection.js';

describe('YouTube persistent connections', () => {
  const secret = 'ab'.repeat(32);
  beforeEach(() => {
    mocks.writes.length = 0;
    mocks.refresh.mockReset().mockResolvedValue({ access_token: 'new-access', expiry_date: 5000 });
    mocks.channels.mockReset().mockResolvedValue({ data: { items: [{ id: 'channel-id' }] } });
    mocks.row = { status: 'connected', tokens: encryptTokens({ refresh_token: 'offline-grant', access_token: 'old-access' }, secret) };
  });
  it('refreshes an account and preserves its offline grant in encrypted storage', async () => {
    const client = await connectedClient('account');
    expect(client.credentials.refresh_token).toBe('offline-grant');
    expect(decryptTokens(mocks.writes[0]!.tokens as string, secret)).toMatchObject({ refresh_token: 'offline-grant', access_token: 'new-access' });
  });
  it('blocks disconnected and reconnect-required accounts before calling Google', async () => {
    mocks.row = undefined;
    await expect(connectedClient('account')).rejects.toThrow('Settings');
    mocks.row = { status: 'reconnect', tokens: '' };
    await expect(connectedClient('account')).rejects.toThrow('Settings');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it('marks revoked refresh grants for reconnect without leaking provider errors', async () => {
    mocks.refresh.mockRejectedValue({ response: { status: 400, data: { error: 'invalid_grant' } } });
    await expect(connectedClient('account')).rejects.toThrow('revoked');
    expect(mocks.writes).toContainEqual({ status: 'reconnect' });
  });
  it('does not mark a temporary outage as revoked', async () => {
    mocks.refresh.mockRejectedValue({ response: { status: 503 } });
    await expect(connectedClient('account')).rejects.toThrow('temporarily');
    expect(mocks.writes).toEqual([]);
  });
  it('verifies the channel and records verification time', async () => {
    expect(await verifyYouTube('account')).toMatchObject({ id: 'channel-id' });
    expect(mocks.writes[1]!.verifiedAt).toBeInstanceOf(Date);
  });
  it('marks revoked access and missing channels for reconnect', async () => {
    mocks.channels.mockRejectedValueOnce({ code: 401 });
    await expect(verifyYouTube('account')).rejects.toThrow('revoked');
    mocks.channels.mockResolvedValueOnce({ data: { items: [] } });
    await expect(verifyYouTube('account')).rejects.toThrow('unavailable');
    expect(mocks.writes.filter(w => w.status === 'reconnect')).toHaveLength(2);
  });
  it('does not confuse upload quota errors with revoked grants', () => {
    expect(isAuthorizationError({ code: 403 })).toBe(false);
    expect(isAuthorizationError({ code: 429 })).toBe(false);
  });
});
