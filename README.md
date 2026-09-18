<div align="center">

# Social Agent AI

**Self-hosted, AI-powered social media automation platform**

Automate your entire social media workflow â€” from AI content generation to multi-platform publishing, performance analytics, and autonomous strategy optimization. All running on your own infrastructure.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Features](#features) Â· [Quick Start](#quick-start) Â· [Documentation](#web-dashboard) Â· [API Reference](#rest-api-reference) Â· [Contributing](#contributing)

</div>

---

## Why Social Agent AI?

Managing social media across multiple platforms is time-consuming and repetitive. Social Agent AI solves this by giving you a **fully autonomous content pipeline** that you own and control:

- **AI generates your content** â€” Google Gemini creates platform-optimized posts with the right tone, length, and hashtags
- **Publishes everywhere at once** â€” Twitter, Instagram, YouTube, TikTok from a single dashboard
- **Learns and improves itself** â€” Weekly strategy optimizer analyzes what works and automatically adjusts your posting strategy
- **Runs on your servers** â€” No SaaS fees, no data sharing, no vendor lock-in. Your content, your infrastructure

Whether you're a solo content creator, a digital agency managing multiple brands, or a developer building automation tools â€” this platform gives you everything out of the box.

---

## Features

### Content Generation Pipeline

| Capability | Description |
| --- | --- |
| **AI Text Generation** | Google Gemini (default `gemini-2.5-flash`) with structured JSON output â€” prompts include the platform's length and hashtag limits, tone and language |
| **Image Generation** | Google Imagen 4 with Pexels stock photo fallback |
| **Text-to-Speech** | Edge TTS neural voices, picked automatically from the content language (tr, en, de, es, fr, it, pt, ar) |
| **Video Assembly** | Full video pipeline: prompt â†’ script â†’ TTS audio â†’ AI image â†’ FFmpeg (Ken Burns, burned-in subtitles, logo, background music) |
| **Safety Checks** | Every post is fitted to platform limits and checked for length, hashtag count and banned words before publishing |
| **Quality Gate** | Optional Gemini quality score â€” autonomous posts below `QUALITY_MIN_SCORE` are held for manual review |

### Multi-Platform Publishing

| Platform | Content Types | Rate Limit | Max Text |
| --- | --- | --- | --- |
| **Twitter** | Text, Image, Video | 25/hr, 300/day | 280 chars |
| **Instagram** | Image, Reel | 10/hr, 50/day | 2,200 chars |
| **YouTube** | Video, Short | 5/hr, 20/day | 5,000 chars |
| **TikTok** | Video | 10/hr, 50/day | 2,200 chars |

Each platform adapter handles API authentication, media uploads, rate limiting, and retry logic independently. Adapters are **auto-registered** based on which API credentials you provide â€” no configuration needed.

### Autonomous Automation

- **Cron-based scheduling** â€” each account gets its own posting schedule via cron expressions
- **Content mix control** â€” configure ratios for original posts, reposts, and replies (e.g. 80/15/5)
- **PostgreSQL job queue** â€” reliable background processing with `SELECT FOR UPDATE SKIP LOCKED` for concurrent-safe dequeuing, plus automatic recovery of jobs interrupted by a crash
- **Plugin system** â€” poll external data sources, transform content, and publish automatically
- **Smart retries** â€” transient failures (timeouts, rate limits, 5xx) retry with exponential backoff; permanent ones (bad credentials, rejected content) fail fast with a clear error

### Analytics & Self-Improvement

- **Automatic tracking** â€” fetches engagement metrics (likes, comments, shares, impressions, reach) every 6 hours
- **Daily reports** â€” WhatsApp summary at 23:00 with engagement totals, top posts, and per-account breakdown
- **Weekly optimization** â€” every Monday at 02:00, analyzes 7-day performance data and auto-tunes:
  - Posting tone (emotional, informative, urgent, hopeful, friendly)
  - Posting schedule (cron expression)
  - Hashtag strategy

### Web Dashboard

A modern, single-page dashboard with dark theme and sidebar navigation:

- **Dashboard** â€” Real-time stat cards, platform breakdown, account performance table, recent activity feed
- **Projects** â€” Create and manage multiple brands/projects with logo uploads and independent configs
- **Accounts** â€” Link social media accounts with platform credentials, assign roles (primary/secondary/backup), define content strategies
- **Posts** â€” Browse, filter, generate AI content with tone/type selection, review quality/safety scores and errors, edit, and publish directly
- **Twitter OAuth** â€” Built-in 3-legged authentication flow
- **Password protection** â€” HTTP Basic Auth for the dashboard and API via `DASHBOARD_PASSWORD`

> The dashboard UI is available in English.

### Notifications

- **WhatsApp integration** via whatsapp-web.js
- Real-time alerts for: content generated, post published, post failed, daily summary reports

---

## Quick Start

### Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | >= 20 | Runtime |
| PostgreSQL | >= 14 | Primary database |
| FFmpeg | Any | *Optional* â€” required for video pipeline |

### Installation

```bash
# Clone your repository
git clone <your-repository-url>
cd social-agent-ai

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see Configuration section)

# Set up database
createdb social_media_bot
npm run db:migrate

# Optional: demo project so you can explore without any social credentials
npm run db:seed

# Start development server (auto-reloads on changes)
npm run dev
```

The dashboard will be available at **http://localhost:3000**

> **Upgrading from 1.0?** If you created your database with `npm run db:push`, just run `npm run db:migrate` â€” existing schemas are detected and baselined automatically.

### Production Deployment

```bash
npm run build
npm start
```

---

## Docker

The easiest way to get started. Includes PostgreSQL, Chromium (for WhatsApp), and FFmpeg.

```bash
# Configure environment
cp .env.example .env
# Set at minimum: GEMINI_API_KEY and DASHBOARD_PASSWORD

# Start all services â€” migrations run automatically on startup
docker compose up -d
```

**What's included in the Docker setup:**

- Multi-stage build, running as a non-root user
- PostgreSQL 16 (Alpine) with health checks, bound to localhost only
- Automatic database migrations on startup
- Chromium for WhatsApp Web.js session
- FFmpeg and fonts for the video pipeline
- Persistent volumes for database, WhatsApp session, generated media and temp files
- Container health check (`/api/health`) and graceful shutdown

> Deploying on a server? Put the app behind HTTPS (Caddy, Nginx, Traefik) and see [SECURITY.md](SECURITY.md).

---

## Configuration

### Required

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `GEMINI_API_KEY` | Google Gemini API key â€” [get one free](https://aistudio.google.com/apikey) |

### Security

| Variable | Default | Description |
| --- | --- | --- |
| `DASHBOARD_PASSWORD` | â€” | Enables HTTP Basic Auth for the dashboard and API. **Set this before exposing the server to any network.** |
| `DASHBOARD_USERNAME` | `admin` | Basic Auth username |

### Platform Credentials

Add credentials for each platform you want to publish to. **Only configure what you need** â€” the system automatically enables platforms based on available credentials.

| Variable | Platform |
| --- | --- |
| `TWITTER_API_KEY`, `TWITTER_API_SECRET` | Twitter API v2 (app credentials) |
| `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET` | Twitter API v2 (user credentials) |
| `TWITTER_CALLBACK_URL` | OAuth2 callback URL (default: `http://localhost:3000/api/twitter/callback`) |
| `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram Graph API |
| `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` | YouTube Data API v3 |
| `TIKTOK_ACCESS_TOKEN` | TikTok Content Posting API |

### Optional

| Variable | Default | Description |
| --- | --- | --- |
| `PUBLIC_BASE_URL` | â€” | Public URL of this server. Required for Instagram to fetch locally generated media |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Text model |
| `GEMINI_IMAGE_MODEL` | `imagen-4.0-generate-001` | Image model |
| `QUALITY_CHECK_ENABLED` | `false` | Score posts with Gemini before publishing (one extra API call per post) |
| `QUALITY_MIN_SCORE` | `60` | Autonomous posts scoring below this are held for review |
| `PEXELS_API_KEY` | â€” | Stock images for media pipeline â€” [get one free](https://www.pexels.com/api/) |
| `WHATSAPP_ADMIN_NUMBER` | â€” | WhatsApp number for admin notifications (e.g. `905xxxxxxxxx`) |
| `PLUGIN_DATABASE_URL` | â€” | External database for content source plugins |
| `RUN_MIGRATIONS` | `false` (`true` in Docker) | Apply database migrations on startup |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | `development` / `production` / `test` |
| `LOG_LEVEL` | `info` | `error` / `warn` / `info` / `debug` |

---

## Architecture

### Project Structure

```
src/
â”œâ”€â”€ index.ts                  # Entry point â€” registers adapters/plugins, starts engine
â”œâ”€â”€ config/
â”‚   â”œâ”€â”€ constants.ts          # Platform limits, rate limits, enums
â”‚   â”œâ”€â”€ env.ts                # Zod environment validation
â”‚   â””â”€â”€ logger.ts             # Winston logger configuration
â”œâ”€â”€ types/
â”‚   â””â”€â”€ index.ts              # TypeScript interfaces (PlatformAdapter, ProjectPlugin, etc.)
â”œâ”€â”€ db/
â”‚   â”œâ”€â”€ index.ts              # Drizzle ORM connection + migration runner
â”‚   â”œâ”€â”€ migrate.ts            # `npm run db:migrate` entry point
â”‚   â””â”€â”€ schema/
â”‚       â””â”€â”€ index.ts          # 6 tables: projects, accounts, posts, postAnalytics, jobQueue, logs
â”œâ”€â”€ core/
â”‚   â”œâ”€â”€ engine.ts             # Main orchestrator â€” job processing, cron registration
â”‚   â”œâ”€â”€ content-service.ts    # Text / video generation + quality gate
â”‚   â”œâ”€â”€ queue.ts              # PostgreSQL job queue (SKIP LOCKED, backoff, stale job recovery)
â”‚   â”œâ”€â”€ scheduler.ts          # node-cron wrapper
â”‚   â”œâ”€â”€ account-scheduler.ts  # Syncs account strategies â†’ cron jobs
â”‚   â”œâ”€â”€ strategy-optimizer.ts # Weekly auto-optimization (tone, schedule, hashtags)
â”‚   â”œâ”€â”€ content-mix.ts        # Original / repost / reply selection
â”‚   â”œâ”€â”€ media.ts              # Resolve local, public and remote media
â”‚   â”œâ”€â”€ rate-limiter.ts       # Per-platform rate limiting via p-queue
â”‚   â”œâ”€â”€ retry.ts              # Exponential backoff with jitter
â”‚   â”œâ”€â”€ errors.ts             # Retryable vs. permanent errors
â”‚   â””â”€â”€ safety-guard.ts       # Platform fitting + content safety validation
â”œâ”€â”€ ai/
â”‚   â”œâ”€â”€ prompt-builder.ts     # Adds platform limits, tone and language to prompts
â”‚   â”œâ”€â”€ text-generator.ts     # Gemini structured text generation
â”‚   â”œâ”€â”€ quality-checker.ts    # AI quality scoring
â”‚   â”œâ”€â”€ image-generator.ts    # Imagen + Pexels fallback
â”‚   â”œâ”€â”€ tts.ts                # Edge TTS text-to-speech
â”‚   â”œâ”€â”€ video-generator.ts    # FFmpeg video assembly
â”‚   â””â”€â”€ video-orchestrator.ts # Full video pipeline orchestrator
â”œâ”€â”€ platforms/
â”‚   â”œâ”€â”€ base.ts               # Abstract base adapter (rate limiting + retry)
â”‚   â”œâ”€â”€ twitter/              # Twitter API v2 + OAuth2 flow
â”‚   â”œâ”€â”€ instagram/            # Instagram Graph API
â”‚   â”œâ”€â”€ youtube/              # YouTube Data API v3
â”‚   â””â”€â”€ tiktok/               # TikTok Content Posting API
â”œâ”€â”€ plugins/
â”‚   â””â”€â”€ catpet/               # Example plugin: animal adoption content
â”œâ”€â”€ analytics/
â”‚   â”œâ”€â”€ tracker.ts            # Fetch & store engagement metrics
â”‚   â””â”€â”€ reporter.ts           # Daily summary report generation
â”œâ”€â”€ notifications/
â”‚   â””â”€â”€ whatsapp.ts           # WhatsApp Web.js integration
â””â”€â”€ server/
    â”œâ”€â”€ index.ts              # Express app setup, health check
    â”œâ”€â”€ middleware.ts         # Basic auth, validation helpers, error handler
    â”œâ”€â”€ schemas.ts            # zod request schemas
    â”œâ”€â”€ routes/
    â”‚   â”œâ”€â”€ dashboard.ts      # Analytics and stats endpoints
    â”‚   â”œâ”€â”€ projects.ts       # Project CRUD + logo upload
    â”‚   â”œâ”€â”€ accounts.ts       # Account CRUD with credential sanitization
    â”‚   â”œâ”€â”€ posts.ts          # Post CRUD, AI generation, publishing
    â”‚   â””â”€â”€ twitter-auth.ts   # Twitter OAuth2 flow
    â””â”€â”€ views/
        â””â”€â”€ index.html        # Single-page dashboard application
```

### Database Schema

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  projects   â”‚       â”‚  accounts   â”‚       â”‚     posts       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤       â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤       â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ id (UUID)   â”‚â—„â”€â”€â”   â”‚ id (UUID)   â”‚â—„â”€â”€â”   â”‚ id (UUID)       â”‚
â”‚ name        â”‚   â”œâ”€â”€â”€â”‚ projectId   â”‚   â”œâ”€â”€â”€â”‚ projectId       â”‚
â”‚ description â”‚   â”‚   â”‚ platform    â”‚   â”‚   â”‚ accountId       â”‚
â”‚ active      â”‚   â”‚   â”‚ role        â”‚   â”‚   â”‚ platform        â”‚
â”‚ config      â”‚   â”‚   â”‚ username    â”‚   â”‚   â”‚ contentType     â”‚
â”‚ createdAt   â”‚   â”‚   â”‚ credentials â”‚   â”‚   â”‚ text, hashtags  â”‚
â”‚ updatedAt   â”‚   â”‚   â”‚ strategy    â”‚   â”‚   â”‚ mediaUrls       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚   â”‚ active      â”‚   â”‚   â”‚ status, tone    â”‚
                  â”‚   â”‚ lastUsedAt  â”‚   â”‚   â”‚ safetyScore     â”‚
                  â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚   â”‚ qualityScore    â”‚
                  â”‚                     â”‚   â”‚ platformPostId  â”‚
                  â”‚                     â”‚   â”‚ publishedAt     â”‚
                  â”‚                     â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                  â”‚                     â”‚            â”‚
                  â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”
                  â”‚   â”‚  jobQueue   â”‚   â”‚   â”‚ postAnalytics   â”‚
                  â”‚   â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤   â”‚   â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
                  â”‚   â”‚ id (UUID)   â”‚   â”‚   â”‚ id (UUID)       â”‚
                  â”‚   â”‚ type        â”‚   â”‚   â”‚ postId          â”‚
                  â”‚   â”‚ status      â”‚   â”‚   â”‚ likes, comments â”‚
                  â”‚   â”‚ payload     â”‚   â”‚   â”‚ shares, reach   â”‚
                  â”‚   â”‚ priority    â”‚   â”‚   â”‚ impressions     â”‚
                  â”‚   â”‚ attempts    â”‚   â”‚   â”‚ engagementRate  â”‚
                  â”‚   â”‚ scheduledAt â”‚   â”‚   â”‚ fetchedAt       â”‚
                  â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                  â”‚                     â”‚
                  â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
                  â”‚   â”‚    logs     â”‚   â”‚
                  â”‚   â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤   â”‚
                  â”‚   â”‚ id (UUID)   â”‚   â”‚
                  â”‚   â”‚ level       â”‚   â”‚
                  â”‚   â”‚ message     â”‚   â”‚
                  â”‚   â”‚ context     â”‚   â”‚
                  â”‚   â”‚ source      â”‚   â”‚
                  â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
                  â”‚                     â”‚
                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### System Flow

```
                     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                     â”‚   Plugins    â”‚ â† poll external sources (RSS, databases, APIs)
                     â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
                            â”‚ ContentRequest
                            â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Schedulerâ”‚â”€â”€â”€â–¶â”‚        Engine         â”‚â”€â”€â”€â–¶â”‚    AI Pipeline   â”‚
â”‚ (cron)   â”‚    â”‚                       â”‚    â”‚                  â”‚
â”‚          â”‚    â”‚  PostgreSQL Job Queue  â”‚â—€â”€â”€â”€â”‚  Gemini (text)   â”‚
â”‚ per-     â”‚    â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚    â”‚  Imagen (image)  â”‚
â”‚ account  â”‚    â”‚  â”‚ SKIP LOCKED     â”‚  â”‚    â”‚  Edge TTS        â”‚
â”‚ strategy â”‚    â”‚  â”‚ dequeue â†’ run   â”‚  â”‚    â”‚  FFmpeg          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â–¼             â–¼             â–¼
        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚ Twitter  â”‚ â”‚Instagram â”‚ â”‚ YouTube  â”‚  + TikTok
        â”‚ API v2   â”‚ â”‚ Graph APIâ”‚ â”‚ Data API â”‚
        â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜
             â”‚             â”‚             â”‚
             â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â–¼
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚      Feedback Loop     â”‚
              â”‚                        â”‚
              â”‚  every 6h â†’ Analytics  â”‚ â† fetch engagement metrics
              â”‚  daily    â†’ Reporter   â”‚ â† WhatsApp summary
              â”‚  weekly   â†’ Optimizer  â”‚ â† auto-tune strategies
              â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Video Generation Pipeline

```
User Prompt
    â”‚
    â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   Gemini    â”‚â”€â”€â”€â–¶â”‚  Edge TTS   â”‚â”€â”€â”€â–¶â”‚ Imagen/Pexelsâ”‚â”€â”€â”€â–¶â”‚   FFmpeg    â”‚
â”‚  (script)   â”‚    â”‚  (audio)    â”‚    â”‚   (image)    â”‚    â”‚  (assembly) â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜
                                                                 â”‚
                                                                 â–¼
                                                          Final .mp4 Video
```

### Scheduled Jobs

| Job | Schedule | What it does |
| --- | --- | --- |
| Plugin polling | Every 5 min | Checks plugins for new content requests |
| Analytics tracking | Every 6 hours | Fetches engagement metrics for all published posts |
| Daily report | 23:00 daily | Sends WhatsApp summary with engagement stats |
| Strategy optimization | Monday 02:00 | Analyzes 7-day data, auto-tunes tone/schedule/hashtags |
| Stale job recovery | Every 10 min | Re-queues jobs interrupted by a crash or restart |
| Account strategies | Per-account cron | Generates and publishes content per account config |

---

## REST API Reference

All endpoints except `/api/health` and the Twitter OAuth callback require Basic Auth when `DASHBOARD_PASSWORD` is set. Request bodies are validated; invalid input returns `400` with an `issues` array.

```bash
curl -u admin:$DASHBOARD_PASSWORD http://localhost:3000/api/posts?status=review
```

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Database connectivity and engine status (public) |

### Projects

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/projects` | List all projects with account and post counts |
| `POST` | `/api/projects` | Create a new project |
| `GET` | `/api/projects/:id` | Get project details |
| `PATCH` | `/api/projects/:id` | Update project |
| `POST` | `/api/projects/:id/logo` | Upload project logo (max 2MB â€” png, jpeg, webp) |
| `DELETE` | `/api/projects/:id` | Delete project (use `?force=true` for cascade) |

### Accounts

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/accounts?projectId=` | List accounts (credentials are sanitized in response) |
| `POST` | `/api/accounts` | Create account with platform credentials and strategy |
| `PATCH` | `/api/accounts/:id` | Update account settings, credentials, or strategy |
| `DELETE` | `/api/accounts/:id` | Delete account (use `?force=true` to also delete its posts) |

### Posts

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/posts` | List posts â€” filter by `projectId`, `platform`, `status`, `limit`, `offset` |
| `POST` | `/api/posts/generate` | Generate AI content (text, or the full video pipeline for `video`/`short`/`reel`) â€” saved with status `review` |
| `GET` | `/api/posts/:id` | Get post with latest analytics data |
| `POST` | `/api/posts/:id/publish` | Publish post to its target platform |
| `PATCH` | `/api/posts/:id` | Update post text, hashtags, or status |
| `DELETE` | `/api/posts/:id` | Delete post |

### Dashboard & Analytics

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/dashboard/stats` | Post counts, job queue status, active accounts |
| `GET` | `/api/dashboard/recent-posts` | Last 20 posts across all platforms |
| `GET` | `/api/dashboard/analytics-summary` | 7-day engagement totals, platform breakdown, daily trend |
| `GET` | `/api/dashboard/account-performance` | Per-account stats: post count, likes, engagement rate |

### Twitter Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/twitter/auth?accountId=` | Start OAuth flow (redirects to Twitter) |
| `GET` | `/api/twitter/callback` | OAuth callback â€” saves tokens to account |

> Dashboard and post list endpoints support an optional `?projectId=` query parameter for project-scoped filtering.

---

## Account Strategies

Each account can run autonomously with a JSON-defined content strategy:

```json
{
  "active": true,
  "tone": "emotional",
  "contentTypes": ["text", "image"],
  "promptTemplate": "Write a social media post about animal welfare",
  "cronExpression": "0 9,13,18 * * *",
  "contentMix": { "original": 80, "repost": 15, "reply": 5 },
  "hashtags": ["#adopt", "#rescue"],
  "language": "tr"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `active` | boolean | Enable/disable automated posting for this account |
| `tone` | string | Content tone â€” `emotional`, `informative`, `urgent`, `hopeful`, `friendly` |
| `contentTypes` | string[] | Allowed types â€” `text`, `image`, `video`, `story`, `reel`, `short` |
| `promptTemplate` | string | Base prompt sent to Gemini for content generation (required when `active`) |
| `cronExpression` | string | Posting schedule in standard cron syntax (validated) |
| `contentMix` | object | Percentage split between original posts, reposts, and replies |
| `hashtags` | string[] | Default hashtags merged with AI-generated ones |
| `language` | string | Content language code (`tr`, `en`, etc.) â€” also selects the TTS voice |

Changes made in the dashboard take effect immediately â€” no restart needed.

The **strategy optimizer** runs every Monday at 02:00, analyzes the past 7 days of engagement data, and automatically adjusts `tone`, `cronExpression`, and `hashtags` to improve performance.

---

## Writing Plugins

Plugins let you feed content from any external source into the automation pipeline. Implement the `ProjectPlugin` interface:

```typescript
import type { ProjectPlugin, ContentRequest, GeneratedContent } from './types/index.js';

export class MyPlugin implements ProjectPlugin {
  name = 'my-plugin';

  async init(): Promise<void> {
    // Connect to your data source (database, API, RSS feed, etc.)
  }

  async poll(): Promise<ContentRequest[]> {
    // Called every 5 minutes â€” return new content requests.
    // `projectId` may be a project UUID or its name; an active account for the
    // platform is picked automatically (primary role first).
    return [];
  }

  transform(content: GeneratedContent): GeneratedContent {
    // Optionally modify AI-generated content before publishing
    return content;
  }

  getPrompt(request: ContentRequest): string {
    // Build the AI prompt when the request has no `prompt` of its own
    return 'Your prompt here...';
  }

  async destroy(): Promise<void> {
    // Clean up connections
  }
}
```

Register your plugin in `src/index.ts`:

```typescript
engine.registerPlugin(new MyPlugin());
```

The engine handles everything else â€” polling your plugin on schedule, generating content via AI, running safety checks, and publishing to all configured platforms.

> See [`src/plugins/catpet/`](src/plugins/catpet/) for a complete working example that polls an external database for animal adoption and lost pet listings.

---

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Runtime** | Node.js 20+ | Server runtime |
| **Language** | TypeScript 5 (strict) | Type safety across the entire codebase |
| **Database** | PostgreSQL 14+ | Primary data store + job queue |
| **ORM** | Drizzle ORM | Type-safe database queries and schema management |
| **AI** | Google Gemini + Imagen | Text generation with structured JSON output, image generation |
| **Web** | Express.js | REST API and dashboard serving |
| **Job Queue** | PostgreSQL `SKIP LOCKED` | Concurrent-safe background job processing |
| **Scheduling** | node-cron | Cron-based task scheduling |
| **Media** | FFmpeg, Edge TTS, Google Imagen, Pexels | Video assembly, TTS, image generation |
| **Validation** | Zod | Runtime environment and input validation |
| **Logging** | Winston | Structured logging with multiple transports |
| **Notifications** | whatsapp-web.js | WhatsApp admin alerts and reports |
| **Testing** | Vitest + GitHub Actions | Unit tests, typecheck, migration and Docker checks on every PR |
| **Container** | Docker (multi-stage) | Production deployment |

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server with auto-reload (tsx watch) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run the compiled production build |
| `npm run check` | Typecheck and run unit tests |
| `npm test` | Run unit tests (Vitest) |
| `npm run db:migrate` | Apply pending database migrations |
| `npm run db:generate` | Generate a migration after changing the schema |
| `npm run db:push` | Push schema directly (quick local prototyping only) |
| `npm run db:studio` | Open Drizzle Studio â€” visual database browser |
| `npm run db:seed` | Create a demo project, account and post |
| `npx tsx scripts/test-video.ts "<project>"` | Run the video pipeline for a project without publishing |

---

## Contributing

Contributions are welcome. Whether it's a new platform adapter, a plugin, a bug fix, a dashboard translation or documentation improvement â€” feel free to open a PR.

```bash
git clone <your-repository-url>
cd social-agent-ai
npm install
cp .env.example .env          # DATABASE_URL and GEMINI_API_KEY at minimum
npm run db:migrate
npm run dev
```

Before opening a PR, run `npm run check`. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the project layout, how to add a platform adapter, and the PR checklist.

**Ideas for a first contribution:** English translation of the dashboard Â· LinkedIn / Bluesky / Threads adapters Â· RSS feed plugin Â· more unit tests.

---

## Responsible Use

Automating social media comes with responsibilities. Respect each platform's terms of service and automation rules, label AI-generated content where required, and don't use this project for spam, fake engagement or impersonation.

---

## Connected Platforms

Open Settings -> Connected Platforms, select a project, and connect YouTube.
Connections belong to project accounts in the existing shared administrator dashboard.
Enable YouTube Data API v3 and create a Web application OAuth client in Google Cloud.
Set `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `YOUTUBE_CALLBACK_URL` in `.env`.
Register that exact callback in Google Cloud, for example
`http://localhost:3001/api/connections/youtube/callback`.
Set `CONNECTION_ENCRYPTION_KEY` to a stable 64-character hex secret generated with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Retain this key securely with database backups. Run `npm run db:migrate` before startup.

Tokens are encrypted with AES-256-GCM in PostgreSQL. Remove legacy
`YOUTUBE_REFRESH_TOKEN` environment values and connect each account through Settings.
Uploads refresh offline credentials automatically without prompting for each post.
Revoked grants require Reconnect. Google consent screens in Testing can issue
short-lived refresh grants; configure production consent for ongoing use.
Google quotas, verification and upload privacy restrictions still apply.
Instagram, TikTok and X await providers in the new UI; existing adapters remain available.

## License

This project is licensed under the MIT License â€” see the [LICENSE](LICENSE) file for details.

