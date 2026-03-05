import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const cleanupFiles: string[] = [];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const file of cleanupFiles.splice(0)) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

function setupEnv(promptPath: string): void {
  process.env.WHATSAPP_ACCESS_TOKEN = 'token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
  process.env.WHATSAPP_VERIFY_TOKEN = 'verify123';
  process.env.WHATSAPP_APP_SECRET = 'secret';
  process.env.AI_PROVIDER = 'claude';
  process.env.ANTHROPIC_API_KEY = 'anthropic';
  process.env.OPENAI_API_KEY = '';
  process.env.AI_MODEL = 'model';
  process.env.SYSTEM_PROMPT_PATH = promptPath;
  process.env.MAX_HISTORY_TURNS = '10';
  process.env.MAX_INPUT_TOKENS = '2000';
  process.env.TELEGRAM_BOT_TOKEN = '';
  process.env.TELEGRAM_CHAT_ID = '';
  process.env.PORT = '3000';
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'info';
  process.env.DB_PATH = ':memory:';
  process.env.RATE_LIMIT_MAX = '5';
}

describe('AiService', () => {
  it('uses fallback when provider fails twice', async () => {
    const promptFile = path.join(os.tmpdir(), `system-${Date.now()}.txt`);
    cleanupFiles.push(promptFile);
    fs.writeFileSync(promptFile, 'System prompt', 'utf8');
    setupEnv(promptFile);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const { AiService, AI_FALLBACK_REPLY } = await import('../src/services/aiService');
    const service = new AiService();
    const result = await service.generateReply({
      phone: '+123',
      userMessage: 'hello',
      history: [],
      requestId: 'req-1'
    });

    expect(result.failed).toBe(true);
    expect(result.usedFallback).toBe(true);
    expect(result.text).toBe(AI_FALLBACK_REPLY);
  });
});
