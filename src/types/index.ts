export type AiProvider = 'claude' | 'openai';

export interface AppConfig {
  whatsappAccessToken: string;
  whatsappPhoneNumberId: string;
  whatsappVerifyToken: string;
  whatsappAppSecret: string;
  aiProvider: AiProvider;
  anthropicApiKey: string;
  openaiApiKey: string;
  aiModel: string;
  systemPromptPath: string;
  maxHistoryTurns: number;
  maxInputTokens: number;
  telegramBotToken: string;
  telegramChatId: string;
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  dbPath: string;
  rateLimitMax: number;
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body?: string };
  type: string;
}

export interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WebhookMessage[];
      };
    }>;
  }>;
}

export interface Contact {
  phone: string;
  bot_paused: number;
  last_inbound_at: number | null;
  created_at: number;
}

export interface ConversationMessage {
  id?: number;
  phone: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface LogContext {
  requestId: string;
  phone_masked: string;
  event: string;
  ms_elapsed: number;
}

export interface AiGenerateInput {
  phone: string;
  userMessage: string;
  history: ConversationMessage[];
  requestId: string;
}

export interface AiGenerateOutput {
  text: string;
  usedFallback: boolean;
  failed: boolean;
}
