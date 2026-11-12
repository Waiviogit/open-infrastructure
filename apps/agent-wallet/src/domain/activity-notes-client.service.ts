import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import type { AgentWalletConfig } from '../config/agent-wallet.config';
import { buildQueryApiV1BaseUrl } from '../utils/waivio-api-urls';
import { normalizeActivityNoteBody } from './activity-note-body';
import { WaivioAuthSessionService } from './waivio-auth-session.service';

const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const ERROR_DETAIL_MAX_CHARS = 200;

const MESSAGE_NOT_FOUND_CODE = 'activity_message_not_found';
const NOTE_NOT_FOUND_CODE = 'activity_note_not_found';
const LIMIT_REACHED_CODE = 'activity_notes_limit_reached';

const noteViewSchema = z.object({
  noteId: z.string().min(1),
  messageId: z.string().min(1),
  body: z.string(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const noteListSchema = z.object({
  items: z.array(noteViewSchema),
  limit: z.number().int().nonnegative(),
});

const errorBodySchema = z.object({
  code: z.string().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
});

export type ActivityNoteView = z.infer<typeof noteViewSchema>;
export type ActivityNoteList = z.infer<typeof noteListSchema>;

export class ActivityNotesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ActivityMessageNotFoundError extends ActivityNotesApiError {}
export class ActivityNoteNotFoundError extends ActivityNotesApiError {}
export class ActivityNotesLimitReachedError extends ActivityNotesApiError {}
export class ActivityNotesUnauthorizedError extends ActivityNotesApiError {}

type AccountScoped = { account?: string; messageId: string };

type RequestSpec = {
  account?: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: { body: string };
};

/**
 * HTTP client for query-api activity message notes, authenticated as the agent's own
 * registry account (Waivio JWT from `WaivioAuthSessionService`). Notes are private to that
 * account; the token never leaves the process.
 */
@Injectable()
export class ActivityNotesClientService {
  constructor(
    private readonly config: ConfigService<AgentWalletConfig, true>,
    private readonly waivioAuth: WaivioAuthSessionService,
  ) {}

  async list(input: AccountScoped): Promise<ActivityNoteList> {
    const response = await this.request({
      account: input.account,
      method: 'GET',
      path: this.notesPath(input.messageId),
    });
    return this.parseJson(response, noteListSchema);
  }

  async create(input: AccountScoped & { body: string }): Promise<ActivityNoteView> {
    const response = await this.request({
      account: input.account,
      method: 'POST',
      path: this.notesPath(input.messageId),
      body: { body: normalizeActivityNoteBody(input.body) },
    });
    return this.parseJson(response, noteViewSchema);
  }

  async update(
    input: AccountScoped & { noteId: string; body: string },
  ): Promise<ActivityNoteView> {
    const response = await this.request({
      account: input.account,
      method: 'PATCH',
      path: this.notePath(input.messageId, input.noteId),
      body: { body: normalizeActivityNoteBody(input.body) },
    });
    return this.parseJson(response, noteViewSchema);
  }

  async delete(input: AccountScoped & { noteId: string }): Promise<void> {
    await this.request({
      account: input.account,
      method: 'DELETE',
      path: this.notePath(input.messageId, input.noteId),
    });
  }

  async deleteAll(input: AccountScoped): Promise<void> {
    await this.request({
      account: input.account,
      method: 'DELETE',
      path: this.notesPath(input.messageId),
    });
  }

  private notesPath(messageId: string): string {
    const id = messageId.trim();
    if (!id) {
      throw new Error('messageId is required');
    }
    return `/messages/${encodeURIComponent(id)}/notes`;
  }

  private notePath(messageId: string, noteId: string): string {
    const id = noteId.trim();
    if (!id) {
      throw new Error('noteId is required');
    }
    return `${this.notesPath(messageId)}/${encodeURIComponent(id)}`;
  }

  private async request(spec: RequestSpec, allowRetry = true): Promise<Response> {
    const accessToken = await this.waivioAuth.getAccessToken(
      spec.account,
      !allowRetry,
    );
    const url = `${buildQueryApiV1BaseUrl(this.config.get('queryApiOrigin', { infer: true }))}${spec.path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
    if (spec.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: spec.method,
      headers,
      ...(spec.body ? { body: JSON.stringify(spec.body) } : {}),
    });

    if (response.status === HTTP_UNAUTHORIZED && allowRetry) {
      return this.request(spec, false);
    }
    if (!response.ok) {
      throw await this.toError(response, spec);
    }
    return response;
  }

  private async toError(
    response: Response,
    spec: RequestSpec,
  ): Promise<ActivityNotesApiError> {
    const { code, detail } = await this.readErrorBody(response);
    const status = response.status;
    const who = spec.account?.trim() ? `@${spec.account.trim()}` : 'the default account';

    if (status === HTTP_UNAUTHORIZED) {
      return new ActivityNotesUnauthorizedError(
        `query-api rejected the Waivio token for ${who}; run waivio_auth_start for that account`,
        status,
        code,
      );
    }
    if (status === HTTP_NOT_FOUND && code === MESSAGE_NOT_FOUND_CODE) {
      return new ActivityMessageNotFoundError(
        'Activity message not found (check messageId)',
        status,
        code,
      );
    }
    if (status === HTTP_NOT_FOUND && code === NOTE_NOT_FOUND_CODE) {
      return new ActivityNoteNotFoundError(
        `Note not found for ${who} (wrong noteId, or it belongs to another account)`,
        status,
        code,
      );
    }
    if (status === HTTP_CONFLICT && code === LIMIT_REACHED_CODE) {
      return new ActivityNotesLimitReachedError(
        `Note limit reached for ${who} on this activity item; update or delete an existing note`,
        status,
        code,
      );
    }
    if (status === HTTP_NOT_FOUND) {
      return new ActivityNotesApiError(
        `query-api returned 404 for ${spec.method} ${spec.path}; check QUERY_API_ORIGIN routes /query/v1`,
        status,
        code,
      );
    }
    return new ActivityNotesApiError(
      detail
        ? `Activity notes request failed (${status}): ${detail}`
        : `Activity notes request failed (${status})`,
      status,
      code,
    );
  }

  private async readErrorBody(
    response: Response,
  ): Promise<{ code?: string; detail?: string }> {
    let text: string;
    try {
      text = (await response.text()).trim();
    } catch {
      return {};
    }
    if (!text) {
      return {};
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { detail: this.truncate(text) };
    }

    const parsed = errorBodySchema.safeParse(json);
    if (!parsed.success) {
      return { detail: this.truncate(text) };
    }
    const message = Array.isArray(parsed.data.message)
      ? parsed.data.message.join(', ')
      : parsed.data.message;
    return { code: parsed.data.code, detail: message ?? parsed.data.code };
  }

  private truncate(text: string): string {
    return text.length > ERROR_DETAIL_MAX_CHARS
      ? `${text.slice(0, ERROR_DETAIL_MAX_CHARS)}…`
      : text;
  }

  private async parseJson<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    if (response.status === HTTP_NO_CONTENT) {
      throw new Error('query-api returned no content where a note was expected');
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new Error('query-api returned invalid JSON for activity notes');
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `Unexpected activity notes response shape: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
          .join('; ')}`,
      );
    }
    return parsed.data;
  }
}
