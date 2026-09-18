import { google } from 'googleapis';
import * as fs from 'fs';
import { Platform } from '../../config/constants.js';
import type { GeneratedContent, PlatformPostResult, PostAnalyticsData } from '../../types/index.js';
import { BasePlatformAdapter } from '../base.js';
import { connectedClient, isAuthorizationError, markReconnect } from './connection.js';
import { NonRetryableError } from '../../core/errors.js';
import { normalizeHashtag } from '../../core/safety-guard.js';
import { resolveMediaFile } from '../../core/media.js';

function firstSentence(text: string): string {
  const match = text.trim().match(/^[^.!?\n]+[.!?]?/);
  return (match?.[0] ?? text).trim();
}

export class YouTubeAdapter extends BasePlatformAdapter {
  platform = Platform.YOUTUBE as const;

  async init(): Promise<void> {
    this.log('Adapter initialized');
  }

  async destroy(): Promise<void> {
    this.log('Adapter destroyed');
  }

  private async getClient(accountId: string) {
    return google.youtube({ version: 'v3', auth: await connectedClient(accountId) });
  }

  private async connectionFailure(error: unknown, accountId: string): Promise<never> {
    if (isAuthorizationError(error)) {
      await markReconnect(accountId);
      throw new NonRetryableError('YouTube authorization revoked; reconnect in Settings');
    }
    const provider = error as { code?: unknown; response?: { status?: number } };
    const status = provider?.response?.status ?? (typeof provider?.code === 'number' ? provider.code : undefined);
    throw Object.assign(new Error('YouTube request failed. Check platform quota and account permissions.'), { status });
  }

  protected async doPost(content: GeneratedContent, _accountId: string): Promise<PlatformPostResult> {
    const youtube = await this.getClient(_accountId);
    const mediaUrl = content.mediaUrls?.[0];

    if (!mediaUrl) {
      return { success: false, error: 'YouTube requires a video file' };
    }

    let media: Awaited<ReturnType<typeof resolveMediaFile>>;
    try {
      media = await resolveMediaFile(mediaUrl);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    const hashtags = content.hashtags.map(normalizeHashtag);
    const description = [content.text, '', hashtags.join(' ')].join('\n').slice(0, 5000);
    // YouTube rejects titles over 100 chars or containing angle brackets
    const title = firstSentence(content.text).replace(/[<>]/g, '').slice(0, 100) || 'Untitled';
    const language = content.metadata?.['language'];

    let res;
    try {
      res = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            tags: hashtags.map((h) => h.slice(1)),
            categoryId: '22', // People & Blogs
            ...(typeof language === 'string' ? { defaultLanguage: language } : {}),
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(media.filePath),
        },
      });
    } catch (error) {
      await this.connectionFailure(error, _accountId);
    } finally {
      media.cleanup();
    }

    const videoId = res!.data.id;
    if (!videoId) {
      return { success: false, error: 'YouTube upload returned no video ID' };
    }

    this.log('Video uploaded', { videoId });
    return {
      success: true,
      platformPostId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  protected async doDelete(platformPostId: string, _accountId: string): Promise<boolean> {
    const youtube = await this.getClient(_accountId);
    await youtube.videos.delete({ id: platformPostId }).catch(error => this.connectionFailure(error, _accountId));
    this.log('Video deleted', { platformPostId });
    return true;
  }

  protected async doGetAnalytics(platformPostId: string, _accountId: string): Promise<PostAnalyticsData> {
    const youtube = await this.getClient(_accountId);

    const res = await youtube.videos.list({
      part: ['statistics'],
      id: [platformPostId],
    }).catch(error => this.connectionFailure(error, _accountId));

    const stats = res.data.items?.[0]?.statistics;

    const views = parseInt(stats?.viewCount ?? '0');
    const likes = parseInt(stats?.likeCount ?? '0');
    const comments = parseInt(stats?.commentCount ?? '0');

    return {
      likes,
      comments,
      shares: 0,
      impressions: views,
      reach: views,
      engagementRate: views > 0 ? ((likes + comments) / views) * 100 : 0,
    };
  }
}
