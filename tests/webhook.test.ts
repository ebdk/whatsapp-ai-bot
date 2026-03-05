import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = {
  WHATSAPP_ACCESS_TOKEN: 'token',
  WHATSAPP_PHONE_NUMBER_ID: '123',
  WHATSAPP_VERIFY_TOKEN: 'verify123',
  WHATSAPP_APP_SECRET: 'secret',
  AI_PROVIDER: 'claude',
  ANTHROPIC_API_KEY: 'a',
  OPENAI_API_KEY: '',
  AI_MODEL: 'model',
  SYSTEM_PROMPT_PATH: './prompts/system.txt',
  MAX_HISTORY_TURNS: '10',
  MAX_INPUT_TOKENS: '2000',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  PORT: '3000',
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  DB_PATH: ':memory:',
  RATE_LIMIT_MAX: '5'
};

beforeEach(async () => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
});

describe('webhookController', () => {
  it('verifies GET webhook challenge', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    const response = await request(app)
      .get('/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify123', 'hub.challenge': 'challenge-ok' });

    expect(response.status).toBe(200);
    expect(response.text).toBe('challenge-ok');
  });

  it('rejects webhook with invalid signature', async () => {
    const { createApp } = await import('../src/app');
    const app = createApp();

    const response = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', 'sha256=invalid')
      .set('content-type', 'application/json')
      .send(JSON.stringify({}));

    expect(response.status).toBe(403);
  });

  it('accepts valid and fresh webhook', async () => {
    const { createApp } = await import('../src/app');
    const { computeWhatsAppSignature } = await import('../src/utils/crypto');
    const app = createApp();

    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ from: '+12345', type: 'text', text: { body: 'hi' }, timestamp: String(now) }] } }] }]
    }));
    const signature = computeWhatsAppSignature(payload, 'secret');

    const response = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', signature)
      .set('content-type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
  });

  it('rejects stale webhook messages', async () => {
    const { createApp } = await import('../src/app');
    const { computeWhatsAppSignature } = await import('../src/utils/crypto');
    const app = createApp();

    const old = Math.floor(Date.now() / 1000) - 3600;
    const payload = Buffer.from(JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ from: '+12345', type: 'text', text: { body: 'hi' }, timestamp: String(old) }] } }] }]
    }));
    const signature = computeWhatsAppSignature(payload, 'secret');

    const response = await request(app)
      .post('/webhook')
      .set('x-hub-signature-256', signature)
      .set('content-type', 'application/json')
      .send(payload);

    expect(response.status).toBe(403);
  });
});
