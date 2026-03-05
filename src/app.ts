import crypto from 'node:crypto';
import express from 'express';
import { config } from './config';
import { WebhookController } from './controllers/webhookController';
import { ConversationStore } from './store/conversationStore';
import { AiService } from './services/aiService';
import { WhatsAppClient } from './services/whatsappClient';
import { NotificationService } from './services/notificationService';
import { MessageService } from './services/messageService';
import { RateLimiter } from './services/rateLimiter';

export function createApp(): express.Express {
  const app = express();

  const store = new ConversationStore(config.dbPath);
  const aiService = new AiService();
  const whatsappClient = new WhatsAppClient();
  const notificationService = new NotificationService(store);
  const rateLimiter = new RateLimiter(config.rateLimitMax);
  const messageService = new MessageService(store, aiService, whatsappClient, notificationService, rateLimiter);
  const webhookController = new WebhookController(messageService);

  notificationService.startCommandListener();

  const cleanupTimer = setInterval(() => {
    store.cleanupOldMessages();
  }, 60 * 60 * 1000);

  app.use((req, res, next) => {
    const requestId = req.header('x-request-id') ?? crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('referrer-policy', 'no-referrer');
    next();
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get('/webhook', webhookController.verifyWebhook.bind(webhookController));
  app.post('/webhook', express.raw({ type: 'application/json' }), webhookController.receiveWebhook.bind(webhookController));

  app.use((_req, res) => {
    res.sendStatus(404);
  });

  app.on('close', () => {
    clearInterval(cleanupTimer);
    notificationService.stopCommandListener();
    store.close();
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(config.port);
}
