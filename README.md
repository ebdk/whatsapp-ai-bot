# WhatsApp AI Bot

AI-powered WhatsApp auto-reply service using Node.js + TypeScript, Meta Cloud API webhooks, SQLite conversation context, and Telegram notifications.

## Runtime

- Node.js `24.x` (uses built-in `node:sqlite`)

## Features

- Webhook verification (`GET /webhook`) and signed webhook validation (`POST /webhook`)
- HMAC SHA-256 signature verification with timing-safe compare
- Message freshness check (reject older than 5 minutes)
- SQLite-backed conversation state and message history
- 30-day message cleanup
- AI provider abstraction (`claude` or `openai`) with retry + fallback response
- WhatsApp send client + template API stub for future template support
- Telegram notifications for key events
- Telegram `/resume <phone>` command to unpause bot
- Per-sender rate limiter
- Security headers + structured JSON logs via pino

## 24h window behavior

Before replying, the bot checks whether `last_inbound_at` is within 23 hours. If outside the window, it does not send a free-form message and sends a Telegram alert.

Template sending is stubbed via `sendTemplateMessage(...)`.
Production usage requires Meta-approved templates.

## Environment variables

Use `.env.example` as the source of truth.

## Local development

1. `cp .env.example .env` and fill in required values.
2. `docker-compose up --build`
3. `ngrok http 3000`
4. Configure Meta webhook URL as `https://<ngrok-url>/webhook`
5. `npm test`

## Scripts

- `npm run dev` — run app in watch mode
- `npm run build` — compile TypeScript
- `npm start` — run compiled app
- `npm test` — run tests

## API endpoints

- `GET /health` — healthcheck
- `GET /webhook` — Meta webhook verification
- `POST /webhook` — inbound webhook receiver

## Deployment (Railway)

1. Deploy using `Dockerfile`.
2. Set all environment variables in Railway dashboard.
3. Attach persistent volume for SQLite at `/app/data`.

For managed SQLite, replace local file storage with Turso or equivalent.
