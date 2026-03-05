# HANDOFF

## Session Summary

This repository was scaffolded and implemented for the project:

- **AI-Powered WhatsApp Auto-Reply System with Notifications**
- **Stack**: Node.js + TypeScript + Express + SQLite + Telegram notifications

Implemented files match the requested structure under:

- `src/controllers`, `src/services`, `src/store`, `src/types`, `src/utils`
- `prompts/system.txt`
- `tests/*`
- `.env.example`, `Dockerfile`, `docker-compose.yml`, `railway.toml`, `README.md`

## What Was Implemented

1. **Scaffold + config validation**
- `src/config.ts` uses `zod` for env validation.
- `src/app.ts` exposes `/health` and wires services.

2. **Webhook controller**
- `GET /webhook` verifies:
  - `hub.mode === "subscribe"`
  - `hub.verify_token === WHATSAPP_VERIFY_TOKEN`
  - returns `hub.challenge`
- `POST /webhook`:
  - uses raw request body
  - verifies `X-Hub-Signature-256` using HMAC SHA-256
  - timing-safe compare
  - freshness check against `entry[0].changes[0].value.messages[0].timestamp` (5 min window)
  - responds `200` immediately and processes async

3. **Conversation store + migrations**
- SQLite schema in `src/store/migrations.ts`:
  - `contacts(phone, bot_paused, last_inbound_at, created_at)`
  - `messages(id, phone, role, content, timestamp)`
  - index `idx_messages_phone_ts`
- `src/store/conversationStore.ts` supports:
  - upsert inbound contact + `last_inbound_at`
  - set pause/resume
  - insert message
  - history retrieval in chronological order
  - cleanup of messages older than 30 days

4. **AI service**
- `src/services/aiService.ts`
  - provider switch (`claude` / `openai`)
  - loads system prompt from file
  - retries once, then fallback:
    - `"Thank you for your message! A team member will follow up shortly."`

5. **WhatsApp client**
- `src/services/whatsappClient.ts`
  - `sendTextMessage(...)` implemented
  - `sendTemplateMessage(...)` present as MVP stub with TODO

6. **Notification service**
- `src/services/notificationService.ts`
  - Telegram notify (fire-and-forget with catch/log)
  - events:
    - `NEW_MESSAGE`
    - `AI_FAILURE`
    - `WINDOW_EXPIRED`
    - `HUMAN_TAKEOVER`
    - `BOT_RESUMED`
  - polling command handler for `/resume <phone>` sets `bot_paused=0`

7. **Message orchestration**
- `src/services/messageService.ts`
  - parses inbound text message
  - input sanitize + truncation
  - rate limit by sender
  - human takeover keyword handling
  - 23-hour policy window check before free-form reply
  - AI call + fallback handling + WhatsApp send
  - message persistence

8. **Rate limiter + security headers**
- `src/services/rateLimiter.ts` in-memory per-sender limiter
- security headers in `src/app.ts`:
  - `x-content-type-options`
  - `x-frame-options`
  - `referrer-policy`
  - request id header

9. **Deploy/dev config**
- Docker + compose + Railway config created
- README updated with runtime and usage

## Important Change Made Mid-Session

To avoid Windows native build failures (`better-sqlite3` + `node-gyp`), SQLite dependency was switched:

- **Removed**: `better-sqlite3`
- **Now using**: built-in `node:sqlite` (`DatabaseSync`)
- Dockerfile runtime updated to Node 24 (`node:24-alpine`)

This was done to make local install easier on Node 24 without Python/MSVC toolchain.

## Current Known State

- Local git repo initialized in this folder.
- Branch renamed to `main`.
- Initial commit created:
  - `3cdf58d Initial commit: WhatsApp AI bot scaffold and MVP services`
- Remote set to:
  - `https://github.com/ebdk/whatsapp-ai-bot.git`
- Push from this environment failed due missing interactive GitHub auth.

## What Is Left To Do

1. Push from your authenticated machine:
```bash
git push -u origin main
```

2. On Kubuntu:
```bash
git clone https://github.com/ebdk/whatsapp-ai-bot.git
cd whatsapp-ai-bot
npm install
cp .env.example .env
# fill .env
npm test
npm run dev
```

3. Verify app:
```bash
curl http://localhost:3000/health
```

## Notes About Tests

- Tests exist in:
  - `tests/webhook.test.ts`
  - `tests/conversationStore.test.ts`
  - `tests/aiService.test.ts`
- In this sandbox I could not complete dependency install due network restrictions, so tests were not run end-to-end here.

## Environment Variables

Use `.env.example` as baseline. Required non-empty values include:

- WhatsApp:
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_VERIFY_TOKEN`
  - `WHATSAPP_APP_SECRET`
- AI:
  - `AI_PROVIDER`
  - `AI_MODEL`
  - provider key for selected provider
- App:
  - `DB_PATH`

## Quick Troubleshooting

- If `npm install` fails on Windows with native build errors:
  - this repo should now avoid native sqlite addon requirements
  - delete `node_modules` + `package-lock.json` and reinstall
- If webhook verify fails:
  - confirm Meta verify token exactly matches `WHATSAPP_VERIFY_TOKEN`
- If messages are accepted but no replies:
  - check 23-hour window logic (`last_inbound_at`)
  - check Telegram notifications for AI failures

