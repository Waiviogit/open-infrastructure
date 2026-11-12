import type { Kysely } from 'kysely';
import { sql } from 'kysely';

/**
 * Private per-account notes on activity messages (query-api, JWT subject only).
 * Notes are removed together with their message (`ON DELETE CASCADE`).
 * @see docs/spec/data-model/messages.md
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE activity_message_notes (
      note_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author     TEXT NOT NULL,
      message_id TEXT NOT NULL REFERENCES messages (message_id) ON DELETE CASCADE,
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX activity_message_notes_author_message_idx
    ON activity_message_notes (author, message_id, created_at)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS activity_message_notes_author_message_idx`.execute(
    db,
  );
  await sql`DROP TABLE IF EXISTS activity_message_notes`.execute(db);
}
