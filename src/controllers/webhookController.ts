import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from '../config';
import { computeWhatsAppSignature, timingSafeSignatureCompare } from '../utils/crypto';
import type { WebhookPayload } from '../types';
import { logger, maskPhone } from '../utils/logger';
import type { MessageService } from '../services/messageService';

const FRESHNESS_WINDOW_SECONDS = 5 * 60;

function extractTimestamp(payload: WebhookPayload): number | null {
  const raw = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.timestamp;
  if (!raw) return null;
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : null;
}

function extractPhone(payload: WebhookPayload): string {
  return payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ?? 'n/a';
}

export class WebhookController {
  constructor(private readonly messageService: MessageService) {}

  verifyWebhook(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsappVerifyToken && typeof challenge === 'string') {
      res.status(200).send(challenge);
      return;
    }

    res.sendStatus(403);
  }

  receiveWebhook(req: Request, res: Response): void {
    const started = Date.now();
    const requestId = req.header('x-request-id') ?? crypto.randomUUID();
    const signatureHeader = req.header('x-hub-signature-256');
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const expected = computeWhatsAppSignature(rawBody, config.whatsappAppSecret);

    if (!signatureHeader || !timingSafeSignatureCompare(expected, signatureHeader)) {
      logger.warn({ requestId, phone_masked: 'n/a', event: 'WEBHOOK_SIGNATURE_MISMATCH', ms_elapsed: Date.now() - started }, 'Rejected webhook signature');
      res.sendStatus(403);
      return;
    }

    let payload: WebhookPayload;

    try {
      payload = JSON.parse(rawBody.toString('utf8')) as WebhookPayload;
    } catch {
      logger.warn({ requestId, phone_masked: 'n/a', event: 'WEBHOOK_INVALID_JSON', ms_elapsed: Date.now() - started }, 'Invalid webhook JSON');
      res.sendStatus(400);
      return;
    }

    const ts = extractTimestamp(payload);
    if (ts !== null) {
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > FRESHNESS_WINDOW_SECONDS) {
        logger.warn({ requestId, phone_masked: maskPhone(extractPhone(payload)), event: 'WEBHOOK_STALE_MESSAGE', ms_elapsed: Date.now() - started }, 'Stale webhook message rejected');
        res.sendStatus(403);
        return;
      }
    }

    res.sendStatus(200);

    setImmediate(() => {
      void this.messageService.handleIncoming(payload, requestId).catch((error) => {
        logger.error({ requestId, phone_masked: maskPhone(extractPhone(payload)), event: 'WEBHOOK_PROCESSING_FAILED', ms_elapsed: Date.now() - started, err: String(error) }, 'Webhook processing failed');
      });
    });
  }
}
