/** Max note body length in characters (after trim) — same limit as query-api and the web import link. */
export const ACTIVITY_NOTE_BODY_MAX_LENGTH = 20_000;

/** Hash parameter the web activity page reads the imported note from (`#note=…`). */
export const ACTIVITY_NOTE_IMPORT_HASH_PARAM = 'note';

/** Notes per activity item per account; enforced by query-api (409), mirrored here for tool text only. */
export const ACTIVITY_NOTES_PER_ITEM_LIMIT = 10;
