import dotenv from 'dotenv';
import { z } from 'zod';
import type { AppConfig } from './types';

dotenv.config();

const envSchema = z.object({
  WHATSAPP_ACCESS_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_APP_SECRET: z.string().min(1),
  AI_PROVIDER: z.enum(['claude', 'openai']).default('claude'),
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().min(1),
  SYSTEM_PROMPT_PATH: z.string().min(1),
  MAX_HISTORY_TURNS: z.coerce.number().int().positive().default(10),
  MAX_INPUT_TOKENS: z.coerce.number().int().positive().default(2000),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_CHAT_ID: z.string().default(''),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  DB_PATH: z.string().min(1),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5)
}).superRefine((data, ctx) => {
  if (data.AI_PROVIDER === 'claude' && !data.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ANTHROPIC_API_KEY is required when AI_PROVIDER=claude',
      path: ['ANTHROPIC_API_KEY']
    });
  }

  if (data.AI_PROVIDER === 'openai' && !data.OPENAI_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'OPENAI_API_KEY is required when AI_PROVIDER=openai',
      path: ['OPENAI_API_KEY']
    });
  }
});

const parsed = envSchema.parse(process.env);

export const config: AppConfig = {
  whatsappAccessToken: parsed.WHATSAPP_ACCESS_TOKEN,
  whatsappPhoneNumberId: parsed.WHATSAPP_PHONE_NUMBER_ID,
  whatsappVerifyToken: parsed.WHATSAPP_VERIFY_TOKEN,
  whatsappAppSecret: parsed.WHATSAPP_APP_SECRET,
  aiProvider: parsed.AI_PROVIDER,
  anthropicApiKey: parsed.ANTHROPIC_API_KEY,
  openaiApiKey: parsed.OPENAI_API_KEY,
  aiModel: parsed.AI_MODEL,
  systemPromptPath: parsed.SYSTEM_PROMPT_PATH,
  maxHistoryTurns: parsed.MAX_HISTORY_TURNS,
  maxInputTokens: parsed.MAX_INPUT_TOKENS,
  telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
  telegramChatId: parsed.TELEGRAM_CHAT_ID,
  port: parsed.PORT,
  nodeEnv: parsed.NODE_ENV,
  logLevel: parsed.NODE_ENV === 'production' && parsed.LOG_LEVEL === 'debug' ? 'info' : parsed.LOG_LEVEL,
  dbPath: parsed.DB_PATH,
  rateLimitMax: parsed.RATE_LIMIT_MAX
};
