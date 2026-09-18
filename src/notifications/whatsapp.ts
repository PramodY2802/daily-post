import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let client: InstanceType<typeof Client> | null = null;
let ready = false;

export async function initWhatsApp(): Promise<void> {
  if (!env.WHATSAPP_ADMIN_NUMBER) {
    logger.warn('WhatsApp admin number not configured, notifications disabled');
    return;
  }

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox'] },
  });

  client.on('ready', () => {
    ready = true;
    logger.info('WhatsApp client ready');
  });

  client.on('auth_failure', (msg: string) => {
    logger.error('WhatsApp auth failure', { message: msg });
  });

  client.on('disconnected', (reason: string) => {
    ready = false;
    logger.warn('WhatsApp disconnected', { reason });
  });

  await client.initialize();
}

export async function sendAdminMessage(message: string): Promise<void> {
  if (!client || !ready || !env.WHATSAPP_ADMIN_NUMBER) {
    logger.debug('WhatsApp not available, skipping notification');
    return;
  }

  try {
    const chatId = `${env.WHATSAPP_ADMIN_NUMBER}@c.us`;
    await client.sendMessage(chatId, message);
    logger.debug('WhatsApp message sent to admin');
  } catch (err) {
    logger.error('Failed to send WhatsApp message', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function notifyError(source: string, error: string): Promise<void> {
  await sendAdminMessage(`⚠️ *ERROR*\nSource: ${source}\nError: ${error}\nTime: ${new Date().toLocaleString('en-US')}`);
}

export async function notifyDailySummary(report: {
  totalPosts: number;
  postsPublished: number;
  postsFailed: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalImpressions: number;
  avgEngagementRate: number;
  topPosts: Array<{ platform: string; username: string; text: string; likes: number }>;
  accountBreakdowns: Array<{ username: string; platform: string; postCount: number; totalLikes: number }>;
}): Promise<void> {
  const date = new Date().toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmt = (n: number) => n.toLocaleString('en-US');

  let msg =
    `📊 *Daily PR Report - ${date}*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📝 Total Posts: ${report.totalPosts}\n` +
    `✅ Published: ${report.postsPublished}\n` +
    `❌ Failed: ${report.postsFailed}\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `❤️ Likes: ${fmt(report.totalLikes)}\n` +
    `💬 Comments: ${fmt(report.totalComments)}\n` +
    `🔄 Shares: ${fmt(report.totalShares)}\n` +
    `👁️ Impressions: ${fmt(report.totalImpressions)}\n` +
    `📈 Avg. Engagement: ${report.avgEngagementRate.toFixed(2)}%`;

  if (report.topPosts.length > 0) {
    msg += `\n\n🏆 *Top ${Math.min(report.topPosts.length, 3)} Posts*`;
    for (let i = 0; i < Math.min(report.topPosts.length, 3); i++) {
      const p = report.topPosts[i]!;
      const preview = p.text.length > 30 ? p.text.substring(0, 30) + '...' : p.text;
      msg += `\n${i + 1}. [${p.platform}] @${p.username} — ${preview} (${p.likes} ❤️)`;
    }
  }

  if (report.accountBreakdowns.length > 0) {
    msg += `\n\n📊 *Account Performance*`;
    for (const ab of report.accountBreakdowns) {
      msg += `\n• @${ab.username} (${ab.platform}): ${ab.postCount} post, ${fmt(ab.totalLikes)} ❤️`;
    }
  }

  await sendAdminMessage(msg);
}

export async function notifyAccountStatus(account: string, status: string): Promise<void> {
  await sendAdminMessage(`🔔 *Account Status*\nAccount: ${account}\nStatus: ${status}`);
}

export async function notifyPostPublished(details: {
  username: string;
  platform: string;
  text: string;
  hashtags: string[];
  platformUrl?: string | null;
  platformPostId?: string | null;
}): Promise<void> {
  const platformIcons: Record<string, string> = {
    twitter: '🐦', instagram: '📸', youtube: '▶️', tiktok: '🎵',
  };
  const icon = platformIcons[details.platform] || '📱';
  const preview = details.text.length > 120 ? details.text.substring(0, 120) + '...' : details.text;
  const tags = details.hashtags.length > 0 ? details.hashtags.join(' ') : '-';
  const link = details.platformUrl || '-';

  await sendAdminMessage(
    `${icon} *POST YAYINLANDI*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👤 Account: *${details.username}*\n` +
    `📡 Platform: *${details.platform.toUpperCase()}*\n` +
    `📝 Content:\n${preview}\n` +
    `🏷️ Hashtags: ${tags}\n` +
    `🔗 Link: ${link}\n` +
    `⏰ Time: ${new Date().toLocaleString('en-US')}`,
  );
}

export async function notifyPostFailed(details: {
  username: string;
  platform: string;
  text: string;
  error: string;
}): Promise<void> {
  const preview = details.text.length > 80 ? details.text.substring(0, 80) + '...' : details.text;

  await sendAdminMessage(
    `❌ *POST FAILED*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👤 Account: *${details.username}*\n` +
    `📡 Platform: *${details.platform.toUpperCase()}*\n` +
    `📝 Content: ${preview}\n` +
    `⚠️ Error: ${details.error}\n` +
    `⏰ Time: ${new Date().toLocaleString('en-US')}`,
  );
}

export async function notifyContentGenerated(details: {
  username: string;
  platform: string;
  contentType: string;
  text: string;
}): Promise<void> {
  const preview = details.text.length > 100 ? details.text.substring(0, 100) + '...' : details.text;

  await sendAdminMessage(
    `✍️ *CONTENT GENERATED*\n` +
    `👤 Account: *${details.username}*\n` +
    `📡 Platform: *${details.platform.toUpperCase()}*\n` +
    `📦 Type: ${details.contentType}\n` +
    `📝 Preview: ${preview}\n` +
    `⏰ Time: ${new Date().toLocaleString('en-US')}`,
  );
}

export async function destroyWhatsApp(): Promise<void> {
  if (client) {
    await client.destroy();
    client = null;
    ready = false;
  }
}
