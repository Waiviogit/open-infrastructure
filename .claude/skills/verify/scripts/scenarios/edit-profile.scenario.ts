/**
 * Edit profile (docs/apps/web/spec/pages/settings/edit-profile.md).
 * seed:   accounts `hiveio` (viewer; real chain account so the page prefills and merges from the live chain —
 *         the DB copy is only for the profile page) and `bob`, with `bob/edit-profile-post` as a root post to
 *         comment on. Keys kept by the merge show up in the captured op (e.g. peakd's `pinned` on `hiveio`).
 * drive:  parses the `account_update2` the browser handed to the (fake) Keychain — path in
 *         `VERIFY_CAPTURED_OPS` (JSON array of wire ops) — through the real Hive parser.
 * probe:  accounts_current row of `hiveio` after the update.
 */
import { readFileSync } from 'fs';
import { sql } from 'kysely';
import type { Scenario } from '../indexer-harness';

const VIEWER = 'hiveio';
const AUTHOR = 'bob';
const POST_PERMLINK = 'edit-profile-post';
const CREATED_UNIX = 1_760_000_000;

const scenario: Scenario = {
  async seed(h) {
    const seededMetadata = JSON.stringify({ profile: { name: 'Seeded name', version: 2 } });
    await sql`INSERT INTO accounts_current (name, posting_json_metadata)
      VALUES (${VIEWER}, ${seededMetadata})
      ON CONFLICT (name) DO UPDATE SET posting_json_metadata = EXCLUDED.posting_json_metadata`.execute(h.db);
    await sql`INSERT INTO accounts_current (name) VALUES (${AUTHOR}) ON CONFLICT (name) DO NOTHING`.execute(h.db);
    await h.db
      .insertInto('posts')
      .values({
        author: AUTHOR,
        permlink: POST_PERMLINK,
        title: 'Edit profile verification post',
        body: 'A root post to reply to.',
        depth: 0,
        created: new Date(CREATED_UNIX * 1000).toISOString(),
        created_unix: CREATED_UNIX,
        root_author: AUTHOR,
        root_permlink: POST_PERMLINK,
      } as never)
      .onConflict((oc) => oc.doNothing())
      .execute();
    h.log('accounts', await h.db.selectFrom('accounts_current').select(['name', 'posting_json_metadata']).where('name', 'in', [VIEWER, AUTHOR]).execute());
  },

  async drive(h) {
    const file = process.env.VERIFY_CAPTURED_OPS;
    if (!file) {
      throw new Error('VERIFY_CAPTURED_OPS is not set');
    }
    const ops = (JSON.parse(readFileSync(file, 'utf8')) as Array<[string, Record<string, unknown>]>).filter(
      ([name]) => name === 'account_update2',
    );
    h.log('captured account_update2', ops);
    await h.hiveWireBlock(ops);
  },

  async probe(h) {
    h.log(
      'accounts_current hiveio',
      await h.db.selectFrom('accounts_current').select(['name', 'alias', 'profile_image', 'posting_json_metadata']).where('name', '=', VIEWER).execute(),
    );
  },
};

export default scenario;
