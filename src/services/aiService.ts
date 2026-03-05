import fs from 'node:fs/promises';
import { config } from '../config';
import type { AiGenerateInput, AiGenerateOutput } from '../types';

const FALLBACK_REPLY = 'Thank you for your message! A team member will follow up shortly.';

export class AiService {
  private systemPromptCache: string | null = null;

  async generateReply(input: AiGenerateInput): Promise<AiGenerateOutput> {
    const systemPrompt = await this.getSystemPrompt();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = config.aiProvider === 'claude'
          ? await this.callClaude(systemPrompt, input)
          : await this.callOpenAI(systemPrompt, input);

        if (!text.trim()) {
          continue;
        }

        return { text: text.trim(), usedFallback: false, failed: false };
      } catch {
        // Retry once before fallback.
      }
    }

    return { text: FALLBACK_REPLY, usedFallback: true, failed: true };
  }

  private async getSystemPrompt(): Promise<string> {
    if (!this.systemPromptCache) {
      this.systemPromptCache = await fs.readFile(config.systemPromptPath, 'utf8');
    }
    return this.systemPromptCache;
  }

  private async callClaude(systemPrompt: string, input: AiGenerateInput): Promise<string> {
    const history = input.history.map((item) => ({ role: item.role, content: item.content }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: config.aiModel,
        max_tokens: 512,
        system: systemPrompt,
        messages: [...history, { role: 'user', content: input.userMessage }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? '';
  }

  private async callOpenAI(systemPrompt: string, input: AiGenerateInput): Promise<string> {
    const history = input.history.map((item) => ({ role: item.role, content: item.content }));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: input.userMessage }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content ?? '';
  }
}

export const AI_FALLBACK_REPLY = FALLBACK_REPLY;
