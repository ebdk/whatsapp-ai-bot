import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConversationStore } from '../src/store/conversationStore';

const tempFiles: string[] = [];

afterEach(() => {
  for (const file of tempFiles.splice(0)) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

function createStore(): ConversationStore {
  const file = path.join(os.tmpdir(), `bot-test-${Date.now()}-${Math.random()}.db`);
  tempFiles.push(file);
  return new ConversationStore(file);
}

describe('ConversationStore', () => {
  it('stores and retrieves chronological message history', () => {
    const store = createStore();
    store.insertMessage({ phone: '+123', role: 'user', content: 'Hello', timestamp: 200 });
    store.insertMessage({ phone: '+123', role: 'assistant', content: 'Hi', timestamp: 300 });
    store.insertMessage({ phone: '+123', role: 'user', content: 'Need help', timestamp: 400 });

    const history = store.getHistory('+123', 2);

    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('Hi');
    expect(history[1].content).toBe('Need help');

    store.close();
  });

  it('tracks last inbound timestamp by phone', () => {
    const store = createStore();
    store.upsertInboundContact('+123', 1111);
    store.upsertInboundContact('+123', 2222);

    const contact = store.getContact('+123');

    expect(contact?.last_inbound_at).toBe(2222);
    store.close();
  });

  it('cleans up messages older than 30 days', () => {
    const store = createStore();
    const now = 1_800_000_000_000;
    const oldTs = now - (31 * 24 * 60 * 60 * 1000);

    store.insertMessage({ phone: '+123', role: 'user', content: 'old', timestamp: oldTs });
    store.insertMessage({ phone: '+123', role: 'user', content: 'new', timestamp: now });

    const deleted = store.cleanupOldMessages(now);
    const history = store.getHistory('+123', 10);

    expect(deleted).toBe(1);
    expect(history.map((x) => x.content)).toEqual(['new']);
    store.close();
  });
});
