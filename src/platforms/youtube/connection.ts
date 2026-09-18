import { google } from 'googleapis';
import { and, eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db, schema } from '../../db/index.js';
import { encryptTokens, decryptTokens } from '../../core/connection-crypto.js';
import { NonRetryableError } from '../../core/errors.js';

type Tokens = Parameters<ReturnType<typeof oauthClient>['setCredentials']>[0];
export const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

export function oauthClient() {
  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET || !env.YOUTUBE_CALLBACK_URL || !env.CONNECTION_ENCRYPTION_KEY) {
    throw new NonRetryableError('YouTube application OAuth configuration is incomplete');
  }
  return new google.auth.OAuth2(env.YOUTUBE_CLIENT_ID, env.YOUTUBE_CLIENT_SECRET, env.YOUTUBE_CALLBACK_URL);
}

export function isAuthorizationError(error: unknown): boolean {
  const e = error as { response?: { status?: number; data?: { error?: unknown } }; code?: unknown };
  const detail = e?.response?.data?.error;
  const reasons = typeof detail === 'object' && detail !== null ? (detail as { errors?: { reason?: string }[] }).errors : undefined;
  return e?.response?.status === 401 || e?.code === 401 || detail === 'invalid_grant'
    || Boolean(reasons?.some(e => e.reason === 'insufficientPermissions' || e.reason === 'authError'));
}

export async function markReconnect(accountId: string): Promise<void> {
  await db.update(schema.platformConnections).set({ status: 'reconnect' }).where(eq(schema.platformConnections.accountId, accountId));
}

export async function connectedClient(accountId: string) {
  const [row] = await db.select().from(schema.platformConnections).where(eq(schema.platformConnections.accountId, accountId)).limit(1);
  if (!row || row.status !== 'connected') throw new NonRetryableError('Connect or reconnect YouTube in Settings');
  const client = oauthClient();
  let tokens: Tokens;
  try { tokens = decryptTokens<Tokens>(row.tokens, env.CONNECTION_ENCRYPTION_KEY!); }
  catch { throw new NonRetryableError('YouTube credentials cannot be decrypted; reconnect in Settings'); }
  client.setCredentials(tokens);
  try {
    await client.getAccessToken();
    const merged = { ...tokens, ...client.credentials, refresh_token: client.credentials.refresh_token || tokens.refresh_token };
    // Compare the original ciphertext so a late refresh cannot restore a disconnected grant.
    await db.update(schema.platformConnections).set({ tokens: encryptTokens(merged, env.CONNECTION_ENCRYPTION_KEY!) })
      .where(and(eq(schema.platformConnections.accountId, accountId), eq(schema.platformConnections.tokens, row.tokens), eq(schema.platformConnections.status, 'connected')));
  } catch (error) {
    if (isAuthorizationError(error)) { await markReconnect(accountId); throw new NonRetryableError('YouTube authorization expired or was revoked; reconnect in Settings'); }
    throw new Error('YouTube token refresh is temporarily unavailable');
  }
  return client;
}

export async function verifyYouTube(accountId: string) {
  const client = await connectedClient(accountId);
  try {
    const response = await google.youtube({ version: 'v3', auth: client }).channels.list({ part: ['snippet'], mine: true });
    const channel = response.data.items?.[0];
    if (!channel?.id) { await markReconnect(accountId); throw new NonRetryableError('YouTube channel unavailable; reconnect in Settings'); }
    await db.update(schema.platformConnections).set({ verifiedAt: new Date() }).where(eq(schema.platformConnections.accountId, accountId));
    return channel;
  } catch (error) {
    if (isAuthorizationError(error)) { await markReconnect(accountId); throw new NonRetryableError('YouTube authorization revoked; reconnect in Settings'); }
    if (error instanceof NonRetryableError) throw error;
    throw new Error('YouTube connection verification is temporarily unavailable');
  }
}
