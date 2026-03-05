import type { ConversationStore } from '../store/conversationStore';
import { config } from '../config';
import { logger, maskPhone } from '../utils/logger';
import type { LogContext } from '../types';

type NotificationEvent = 'NEW_MESSAGE' | 'AI_FAILURE' | 'WINDOW_EXPIRED' | 'HUMAN_TAKEOVER' | 'BOT_RESUMED';

export class NotificationService {
  private pollingOffset = 0;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(private readonly store: ConversationStore) {}

  startCommandListener(): void {
    if (!config.telegramBotToken || !config.telegramChatId || this.pollTimer) {
      return;
    }

    this.pollTimer = setInterval(() => {
      void this.pollTelegramCommands().catch((error) => {
        logger.warn({ requestId: 'n/a', phone_masked: 'n/a', event: 'TELEGRAM_POLL_FAILED', ms_elapsed: 0, err: String(error) }, 'Telegram polling failed');
      });
    }, 10_000);
  }

  stopCommandListener(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  notify(event: NotificationEvent, phone: string, bodyPreview = ''): void {
    const text = this.buildMessage(event, phone, bodyPreview);
    const context: LogContext = {
      requestId: 'n/a',
      phone_masked: maskPhone(phone),
      event,
      ms_elapsed: 0
    };

    void this.sendText(text).catch((error) => {
      logger.warn({ ...context, err: String(error) }, 'Notification delivery failed');
    });
  }

  private buildMessage(event: NotificationEvent, phone: string, bodyPreview: string): string {
    const masked = maskPhone(phone);
    const preview = bodyPreview.slice(0, 80);

    switch (event) {
      case 'NEW_MESSAGE':
        return `📩 New message from ${masked}: ${preview}`;
      case 'AI_FAILURE':
        return `🔴 AI failed for ${masked} — fallback sent`;
      case 'WINDOW_EXPIRED':
        return `⚠️ 24h window expired for ${masked}`;
      case 'HUMAN_TAKEOVER':
        return `👋 Human takeover requested by ${masked}`;
      case 'BOT_RESUMED':
        return `✅ Bot resumed for ${masked}`;
      default:
        return `Notification for ${masked}`;
    }
  }

  private async sendText(text: string): Promise<void> {
    if (!config.telegramBotToken || !config.telegramChatId) {
      return;
    }

    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegramChatId, text })
    });

    if (!response.ok) {
      throw new Error(`Telegram send failed: ${response.status}`);
    }
  }

  private async pollTelegramCommands(): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?timeout=1&offset=${this.pollingOffset}`);
    if (!response.ok) {
      throw new Error(`Telegram getUpdates failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: Array<{ update_id: number; message?: { text?: string } }>;
    };

    for (const item of data.result ?? []) {
      this.pollingOffset = item.update_id + 1;
      const text = item.message?.text ?? '';
      const match = text.match(/^\/resume\s+(\+?\d+)/i);
      if (!match) continue;

      const phone = match[1];
      this.store.setBotPaused(phone, false);
      this.notify('BOT_RESUMED', phone);
    }
  }
}
