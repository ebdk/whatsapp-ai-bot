import { config } from '../config';

export class WhatsAppClient {
  private readonly baseUrl = `https://graph.facebook.com/v21.0/${config.whatsappPhoneNumberId}/messages`;

  async sendTextMessage(to: string, text: string): Promise<void> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.whatsappAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      })
    });

    if (!response.ok) {
      throw new Error(`WhatsApp send failed with status ${response.status}`);
    }
  }

  async sendTemplateMessage(
    _to: string,
    _templateName: string,
    _language: string,
    _components: unknown[]
  ): Promise<void> {
    // TODO: Implement Meta-approved template message sending for production use.
  }
}
