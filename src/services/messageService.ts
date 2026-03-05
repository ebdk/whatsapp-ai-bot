import type { WebhookPayload } from '../types';
import { logger, maskPhone } from '../utils/logger';
import { sanitizeInput } from '../utils/sanitize';
import { config } from '../config';
import type { ConversationStore } from '../store/conversationStore';
import type { AiService } from './aiService';
import type { WhatsAppClient } from './whatsappClient';
import type { NotificationService } from './notificationService';
import type { RateLimiter } from './rateLimiter';

export class MessageService {
  constructor(
    private readonly store: ConversationStore,
    private readonly aiService: AiService,
    private readonly whatsappClient: WhatsAppClient,
    private readonly notificationService: NotificationService,
    private readonly rateLimiter: RateLimiter
  ) {}

  async handleIncoming(payload: WebhookPayload, requestId: string): Promise<void> {
    const started = Date.now();
    const message = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message?.from || message.type !== 'text') {
      return;
    }

    const phone = message.from;
    const phoneMasked = maskPhone(phone);
    const inboundTsMs = Number(message.timestamp) * 1000;
    const rawText = message.text?.body ?? '';

    if (!this.rateLimiter.allow(phone)) {
      logger.warn({ requestId, phone_masked: phoneMasked, event: 'RATE_LIMITED', ms_elapsed: Date.now() - started }, 'Rate limit exceeded');
      return;
    }

    this.notificationService.notify('NEW_MESSAGE', phone, rawText);

    if (/\b(human|agent|person)\b/i.test(rawText)) {
      this.store.setBotPaused(phone, true);
      this.notificationService.notify('HUMAN_TAKEOVER', phone);
      logger.info({ requestId, phone_masked: phoneMasked, event: 'HUMAN_TAKEOVER', ms_elapsed: Date.now() - started }, 'Human takeover requested');
      return;
    }

    this.store.upsertInboundContact(phone, inboundTsMs);
    const contact = this.store.getContact(phone);
    if ((contact?.bot_paused ?? 0) === 1) {
      logger.info({ requestId, phone_masked: phoneMasked, event: 'BOT_PAUSED', ms_elapsed: Date.now() - started }, 'Bot paused for contact');
      return;
    }

    const { sanitized, wasSanitized } = sanitizeInput(rawText, config.maxInputTokens);
    if (wasSanitized) {
      logger.warn({ requestId, phone_masked: phoneMasked, event: 'INPUT_SANITIZED', ms_elapsed: Date.now() - started }, 'Input sanitization triggered');
    }

    this.store.insertMessage({
      phone,
      role: 'user',
      content: sanitized,
      timestamp: inboundTsMs
    });

    const lastInboundAt = contact?.last_inbound_at ?? inboundTsMs;
    const withinWindow = Date.now() - lastInboundAt < 23 * 60 * 60 * 1000;

    if (!withinWindow) {
      logger.warn({ requestId, phone_masked: phoneMasked, event: 'WINDOW_EXPIRED', ms_elapsed: Date.now() - started }, 'Outside 24h window');
      this.notificationService.notify('WINDOW_EXPIRED', phone);
      return;
    }

    const history = this.store.getHistory(phone, config.maxHistoryTurns);
    const aiResult = await this.aiService.generateReply({
      phone,
      userMessage: sanitized,
      history,
      requestId
    });

    if (aiResult.failed) {
      this.notificationService.notify('AI_FAILURE', phone);
    }

    await this.whatsappClient.sendTextMessage(phone, aiResult.text);

    this.store.insertMessage({
      phone,
      role: 'assistant',
      content: aiResult.text,
      timestamp: Date.now()
    });

    logger.info({ requestId, phone_masked: phoneMasked, event: 'REPLIED', ms_elapsed: Date.now() - started }, 'Reply sent');
  }
}
