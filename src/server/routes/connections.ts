import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { google } from 'googleapis';
import { db, schema } from '../../db/index.js';
import { env } from '../../config/env.js';
import { encryptTokens } from '../../core/connection-crypto.js';
import { oauthClient, verifyYouTube, connectedClient, YOUTUBE_SCOPES } from '../../platforms/youtube/connection.js';
import { asyncHandler, isUuid } from '../middleware.js';
import { engine } from '../../core/engine.js';
import { syncAccountCrons } from '../../core/account-scheduler.js';

export const connectionsRouter = Router();
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const cookieName = 'daily_post_oauth';
const configured = () => Boolean(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && env.YOUTUBE_CALLBACK_URL && env.CONNECTION_ENCRYPTION_KEY);

// Basic Auth is browser-managed; require same-origin JSON requests for mutations.
connectionsRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method !== 'GET' && (req.get('X-Requested-With') !== 'DailyPost' || (req.get('Origin') && req.get('Origin') !== `${req.protocol}://${req.get('host')}`))) {
    res.status(403).json({ error: 'Same-origin request required' }); return;
  }
  next();
});

connectionsRouter.get('/', asyncHandler(async (req, res) => {
  const projectId = req.query['projectId'];
  if (!isUuid(projectId)) { res.status(400).json({ error: 'A valid projectId is required' }); return; }
  const accounts = await db.select().from(schema.accounts).where(eq(schema.accounts.projectId, projectId));
  for (const account of accounts.filter(a => a.platform === 'youtube')) {
    try { await verifyYouTube(account.id); } catch { /* Preserve stored state on temporary provider failures. */ }
  }
  const connections = await db.select().from(schema.platformConnections);
  res.json(['youtube', 'instagram', 'tiktok', 'twitter'].map(platform => ({
    platform, supported: platform === 'youtube', configured: platform === 'youtube' && configured(),
    accounts: accounts.filter(a => a.platform === platform).map(a => {
      const c = connections.find(c => c.accountId === a.id);
      return { id: a.id, username: a.username, status: c?.status || 'disconnected', verifiedAt: c?.verifiedAt || null };
    }),
  })));
}));

connectionsRouter.post('/youtube/connect', asyncHandler(async (req, res) => {
  const { projectId, accountId } = req.body;
  if (!isUuid(projectId) || (accountId && !isUuid(accountId))) { res.status(400).json({ error: 'Invalid project or account' }); return; }
  if (!configured()) { res.status(503).json({ error: 'YouTube application OAuth configuration is incomplete' }); return; }
  const callbackOrigin = new URL(env.YOUTUBE_CALLBACK_URL!).origin;
  if (`${req.protocol}://${req.get('host')}` !== callbackOrigin) {
    res.status(409).json({
      error: 'YouTube connection must start on the configured dashboard address.',
      redirectUrl: `${callbackOrigin}/#settings`,
    }); return;
  }
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  let account;
  if (accountId) {
    [account] = await db.select().from(schema.accounts).where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.projectId, projectId), eq(schema.accounts.platform, 'youtube'))).limit(1);
    if (!account) { res.status(404).json({ error: 'YouTube account not found in this project' }); return; }
  } else {
    [account] = await db.insert(schema.accounts).values({ projectId, platform: 'youtube', username: 'YouTube', credentials: {}, active: false }).returning();
  }
  const state = randomBytes(32).toString('hex');
  const browser = randomBytes(32).toString('hex');
  const client = oauthClient();
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  await db.delete(schema.oauthSessions).where(lt(schema.oauthSessions.expiresAt, new Date()));
  await db.insert(schema.oauthSessions).values({ state: hash(state), browserHash: hash(browser), accountId: account!.id, verifier: codeVerifier, expiresAt: new Date(Date.now() + 600_000) });
  res.cookie(cookieName, browser, { httpOnly: true, sameSite: 'lax', secure: env.YOUTUBE_CALLBACK_URL!.startsWith('https:'), path: '/api/connections/youtube/callback', maxAge: 600_000 });
  const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: YOUTUBE_SCOPES, state, code_challenge: codeChallenge, code_challenge_method: 'S256' as never });
  res.json({ url });
}));

connectionsRouter.get('/youtube/callback', asyncHandler(async (req, res) => {
  const state = req.query['state'];
  const browser = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  if (typeof state !== 'string' || !browser) { res.status(400).send('Invalid OAuth session. Return to Settings and try again.'); return; }
  const sessionFilter = and(eq(schema.oauthSessions.state, hash(state)), eq(schema.oauthSessions.browserHash, hash(browser)), gt(schema.oauthSessions.expiresAt, new Date()));
  const [session] = await db.select().from(schema.oauthSessions).where(sessionFilter).limit(1);
  res.clearCookie(cookieName, { path: '/api/connections/youtube/callback' });
  if (!session) { res.status(400).send('OAuth session expired or already used. Return to Settings and try again.'); return; }
  if (req.query['error'] || typeof req.query['code'] !== 'string') {
    await db.delete(schema.oauthSessions).where(sessionFilter);
    res.redirect('/?connection=cancelled#settings'); return;
  }
  try {
    const client = oauthClient();
    const { tokens } = await client.getToken({ code: req.query['code'], codeVerifier: session.verifier });
    if (!tokens.refresh_token || !YOUTUBE_SCOPES.every(s => tokens.scope?.split(' ').includes(s))) throw new Error('Missing offline permission');
    client.setCredentials(tokens);
    const response = await google.youtube({ version: 'v3', auth: client }).channels.list({ part: ['snippet'], mine: true });
    const channel = response.data.items?.[0];
    if (!channel?.id) throw new Error('No channel');
    const channelId = channel.id;
    await db.transaction(async tx => {
      // Serialize callback and disconnect so a late callback cannot restore removed credentials.
      await tx.execute(sql`SELECT id FROM accounts WHERE id = ${session.accountId} FOR UPDATE`);
      const [claimed] = await tx.delete(schema.oauthSessions).where(sessionFilter).returning();
      if (!claimed) throw new Error('OAuth session already consumed or disconnected');
      await tx.insert(schema.platformConnections).values({ accountId: session.accountId, tokens: encryptTokens(tokens, env.CONNECTION_ENCRYPTION_KEY!), externalId: channelId, status: 'connected' })
        .onConflictDoUpdate({ target: schema.platformConnections.accountId, set: { tokens: encryptTokens(tokens, env.CONNECTION_ENCRYPTION_KEY!), externalId: channelId, status: 'connected', verifiedAt: new Date() } });
      await tx.update(schema.accounts).set({ username: (channel.snippet?.title || 'YouTube').slice(0, 100), active: true, credentials: {} }).where(eq(schema.accounts.id, session.accountId));
    });
    engine.invalidateAccount(session.accountId);
    await syncAccountCrons().catch(() => {});
    res.redirect('/?connection=connected#settings');
  } catch {
    await db.delete(schema.oauthSessions).where(sessionFilter);
    res.redirect('/?connection=failed#settings');
  }
}));

connectionsRouter.post('/:id/verify', asyncHandler(async (req, res) => {
  if (!isUuid(req.params['id'])) { res.status(400).json({ error: 'Invalid account' }); return; }
  try { await verifyYouTube(req.params['id']); res.json({ status: 'connected' }); }
  catch { res.status(409).json({ error: 'Connection verification failed. Retry or reconnect YouTube.' }); }
}));

connectionsRouter.post('/:id/disconnect', asyncHandler(async (req, res) => {
  const id = req.params['id'];
  if (!isUuid(id)) { res.status(400).json({ error: 'Invalid account' }); return; }
  const [account] = await db.select().from(schema.accounts).where(and(eq(schema.accounts.id, id), eq(schema.accounts.platform, 'youtube'))).limit(1);
  if (!account) { res.status(404).json({ error: 'YouTube account not found' }); return; }
  let client;
  try { client = await connectedClient(id); } catch { /* Local disconnect must work for revoked grants. */ }
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM accounts WHERE id = ${id} FOR UPDATE`);
    await tx.delete(schema.platformConnections).where(eq(schema.platformConnections.accountId, id));
    await tx.delete(schema.oauthSessions).where(eq(schema.oauthSessions.accountId, id));
    await tx.update(schema.accounts).set({ active: false, credentials: {} }).where(eq(schema.accounts.id, id));
  });
  engine.invalidateAccount(id);
  await syncAccountCrons().catch(() => {});
  let revoked = false;
  try { if (client) { await client.revokeCredentials(); revoked = true; } } catch { /* Credentials are already removed locally. */ }
  res.json({ status: 'disconnected', revoked });
}));
