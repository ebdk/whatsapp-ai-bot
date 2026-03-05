import { DatabaseSync } from 'node:sqlite';
import type { Contact, ConversationMessage } from '../types';
import { runMigrations } from './migrations';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class ConversationStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    runMigrations(this.db);
  }

  close(): void {
    this.db.close();
  }

  upsertInboundContact(phone: string, timestampMs: number): void {
    const statement = this.db.prepare(`
      INSERT INTO contacts (phone, last_inbound_at)
      VALUES (?, ?)
      ON CONFLICT(phone) DO UPDATE SET last_inbound_at=excluded.last_inbound_at
    `);
    statement.run(phone, timestampMs);
  }

  getContact(phone: string): Contact | undefined {
    const statement = this.db.prepare('SELECT phone, bot_paused, last_inbound_at, created_at FROM contacts WHERE phone = ?');
    return statement.get(phone) as Contact | undefined;
  }

  setBotPaused(phone: string, paused: boolean): void {
    const statement = this.db.prepare(`
      INSERT INTO contacts (phone, bot_paused)
      VALUES (?, ?)
      ON CONFLICT(phone) DO UPDATE SET bot_paused=excluded.bot_paused
    `);
    statement.run(phone, paused ? 1 : 0);
  }

  insertMessage(message: ConversationMessage): void {
    const statement = this.db.prepare('INSERT INTO messages (phone, role, content, timestamp) VALUES (?, ?, ?, ?)');
    statement.run(message.phone, message.role, message.content, message.timestamp);
  }

  getHistory(phone: string, limit: number): ConversationMessage[] {
    const statement = this.db.prepare(`
      SELECT id, phone, role, content, timestamp
      FROM messages
      WHERE phone = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = statement.all(phone, limit) as ConversationMessage[];
    return rows.reverse();
  }

  cleanupOldMessages(referenceEpochMs = Date.now()): number {
    const cutoff = referenceEpochMs - THIRTY_DAYS_MS;
    const statement = this.db.prepare('DELETE FROM messages WHERE timestamp < ?');
    statement.run(cutoff);
    return Number(this.db.prepare('SELECT changes() AS count').get()?.count ?? 0);
  }
}
