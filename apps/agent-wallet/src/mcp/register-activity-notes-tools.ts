import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  ACTIVITY_NOTE_BODY_MAX_LENGTH,
  ACTIVITY_NOTES_PER_ITEM_LIMIT,
} from '../constants/activity-notes';
import { buildActivityNoteImportLink } from '../domain/activity-note-import-link';
import { ActivityNotesClientService } from '../domain/activity-notes-client.service';
import { jsonToolResult, toolError } from './mcp-tool.helpers';

const OWN_NOTES_SCOPE = `Stored under the agent's OWN Waivio account and private to it: humans never see these notes. To hand a note to a human, use activity_note_import_link instead. Requires active Waivio auth for that account (waivio_auth_start).`;

const objectIdField = z
  .string()
  .min(1)
  .describe('ODL object id (author_permlink) that owns the activity item');

const messageIdField = z
  .string()
  .min(1)
  .describe(
    'Activity message id from query-api object activity (permalink id, e.g. <trxId>-<txIndex>-<opIndex>-<eventIndex>)',
  );

const noteIdField = z.string().uuid().describe('noteId from activity_notes_list / activity_notes_create');

const bodyField = z
  .string()
  .min(1)
  .describe(`Markdown note, max ${ACTIVITY_NOTE_BODY_MAX_LENGTH} characters after trim`);

const ownAccountField = z
  .string()
  .optional()
  .describe(
    "Agent's own registry account whose Waivio auth is used (defaults to the configured/default account)",
  );

async function runTool(action: () => Promise<unknown> | unknown): Promise<CallToolResult> {
  try {
    return jsonToolResult(await action());
  } catch (error) {
    return toolError((error as Error).message);
  }
}

export function registerActivityNotesTools(
  server: McpServer,
  deps: {
    activityNotes: ActivityNotesClientService;
    webOrigin: string;
  },
): void {
  server.registerTool(
    'activity_note_import_link',
    {
      description: `Build the link that hands a markdown note (e.g. comment/reply drafts for a social post) to a HUMAN on one object activity item. Send the url in chat. The human opens it signed in as themselves, previews the note, and clicks "Save to my notes" to keep a private copy under their own account; nothing is saved until they click. No auth, no network, no broadcast. The note text travels inside the link, so anyone with the link can read it: never put secrets in it. Put each copyable variant in its own \`\`\` fenced block (the web shows a Copy button per block). Body max ${ACTIVITY_NOTE_BODY_MAX_LENGTH} characters. Returns { url, urlLength, bodyLength }; when urlLength is very large (over ~8000) some chat apps cut links, so split into several notes.`,
      inputSchema: z.object({
        objectId: objectIdField,
        messageId: messageIdField,
        body: bodyField,
      }),
    },
    async (args) =>
      runTool(() =>
        buildActivityNoteImportLink({
          webOrigin: deps.webOrigin,
          objectId: args.objectId,
          messageId: args.messageId,
          markdown: args.body,
        }),
      ),
  );

  server.registerTool(
    'activity_notes_list',
    {
      description: `List the agent's own notes on one activity item. ${OWN_NOTES_SCOPE} Returns { items: [{ noteId, messageId, body, createdAt, updatedAt }], limit }.`,
      inputSchema: z.object({
        messageId: messageIdField,
        account: ownAccountField,
      }),
    },
    async (args) => runTool(() => deps.activityNotes.list(args)),
  );

  server.registerTool(
    'activity_notes_create',
    {
      description: `Save a note for the agent's own records on one activity item (limit: ${ACTIVITY_NOTES_PER_ITEM_LIMIT} per item per account). ${OWN_NOTES_SCOPE} Returns { noteId, messageId, body, createdAt, updatedAt }.`,
      inputSchema: z.object({
        messageId: messageIdField,
        body: bodyField,
        account: ownAccountField,
      }),
    },
    async (args) => runTool(() => deps.activityNotes.create(args)),
  );

  server.registerTool(
    'activity_notes_update',
    {
      description: `Replace the body of one of the agent's own notes. ${OWN_NOTES_SCOPE} Returns the updated note.`,
      inputSchema: z.object({
        messageId: messageIdField,
        noteId: noteIdField,
        body: bodyField,
        account: ownAccountField,
      }),
    },
    async (args) => runTool(() => deps.activityNotes.update(args)),
  );

  server.registerTool(
    'activity_notes_delete',
    {
      description: `Delete one of the agent's own notes. ${OWN_NOTES_SCOPE} Returns { deleted: true }.`,
      inputSchema: z.object({
        messageId: messageIdField,
        noteId: noteIdField,
        account: ownAccountField,
      }),
    },
    async (args) =>
      runTool(async () => {
        await deps.activityNotes.delete(args);
        return { deleted: true };
      }),
  );

  server.registerTool(
    'activity_notes_delete_all',
    {
      description: `Delete all of the agent's own notes on one activity item. ${OWN_NOTES_SCOPE} Returns { deletedAll: true }.`,
      inputSchema: z.object({
        messageId: messageIdField,
        account: ownAccountField,
      }),
    },
    async (args) =>
      runTool(async () => {
        await deps.activityNotes.deleteAll(args);
        return { deletedAll: true };
      }),
  );
}
