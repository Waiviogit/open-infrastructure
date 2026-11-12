import type { ConfigService } from '@nestjs/config';

import { ACTIVITY_NOTE_BODY_MAX_LENGTH } from '../constants/activity-notes';
import {
  ActivityMessageNotFoundError,
  ActivityNoteNotFoundError,
  ActivityNotesApiError,
  ActivityNotesClientService,
  ActivityNotesLimitReachedError,
  ActivityNotesUnauthorizedError,
} from './activity-notes-client.service';
import type { WaivioAuthSessionService } from './waivio-auth-session.service';

const NOTE = {
  noteId: '6f1c2e0a-3b7d-4a51-9c2e-1f0b7a9d4e21',
  messageId: 'trx-1-0-0',
  body: 'draft',
  createdAt: '2026-11-12T10:00:00.000Z',
  updatedAt: '2026-11-12T10:00:00.000Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ActivityNotesClientService', () => {
  const config = {
    get: jest.fn().mockReturnValue('https://query.example/'),
  } as unknown as ConfigService;
  const getAccessToken = jest.fn();
  const waivioAuth = { getAccessToken } as unknown as WaivioAuthSessionService;
  const service = new ActivityNotesClientService(config, waivioAuth);

  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    getAccessToken.mockResolvedValue('token-1');
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists notes with bearer auth on the encoded message path', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [NOTE], limit: 10 }));

    const result = await service.list({ messageId: 'trx/1 0', account: 'neo.agent' });

    expect(result).toEqual({ items: [NOTE], limit: 10 });
    expect(getAccessToken).toHaveBeenCalledWith('neo.agent', false);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://query.example/query/v1/messages/trx%2F1%200/notes',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
      }),
    );
  });

  it('creates a note with a trimmed JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, NOTE));

    const result = await service.create({ messageId: 'trx-1-0-0', body: '  draft  ' });

    expect(result).toEqual(NOTE);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://query.example/query/v1/messages/trx-1-0-0/notes');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ body: 'draft' }));
    expect(init.headers).toEqual(
      expect.objectContaining({ 'Content-Type': 'application/json' }),
    );
  });

  it('rejects an oversize body before any request', async () => {
    await expect(
      service.create({
        messageId: 'trx-1-0-0',
        body: 'x'.repeat(ACTIVITY_NOTE_BODY_MAX_LENGTH + 1),
      }),
    ).rejects.toThrow(`the limit is ${ACTIVITY_NOTE_BODY_MAX_LENGTH}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('patches and deletes a single note by id', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { ...NOTE, body: 'v2' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const updated = await service.update({
      messageId: 'trx-1-0-0',
      noteId: NOTE.noteId,
      body: 'v2',
    });
    await service.delete({ messageId: 'trx-1-0-0', noteId: NOTE.noteId });

    expect(updated.body).toBe('v2');
    expect(fetchMock.mock.calls[0]).toEqual([
      `https://query.example/query/v1/messages/trx-1-0-0/notes/${NOTE.noteId}`,
      expect.objectContaining({ method: 'PATCH' }),
    ]);
    expect(fetchMock.mock.calls[1]).toEqual([
      `https://query.example/query/v1/messages/trx-1-0-0/notes/${NOTE.noteId}`,
      expect.objectContaining({ method: 'DELETE' }),
    ]);
  });

  it('deletes all notes on the collection path', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await service.deleteAll({ messageId: 'trx-1-0-0' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://query.example/query/v1/messages/trx-1-0-0/notes',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('refreshes the token and retries once on 401', async () => {
    getAccessToken.mockResolvedValueOnce('stale').mockResolvedValueOnce('fresh');
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [], limit: 10 }));

    const result = await service.list({ messageId: 'trx-1-0-0', account: 'neo.agent' });

    expect(result).toEqual({ items: [], limit: 10 });
    expect(getAccessToken).toHaveBeenNthCalledWith(1, 'neo.agent', false);
    expect(getAccessToken).toHaveBeenNthCalledWith(2, 'neo.agent', true);
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(secondInit.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer fresh' }),
    );
  });

  it('throws an unauthorized error when the retry is also 401', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(401, { message: 'Unauthorized' }),
    );

    await expect(
      service.list({ messageId: 'trx-1-0-0', account: 'neo.agent' }),
    ).rejects.toBeInstanceOf(ActivityNotesUnauthorizedError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps 409 limit reached to a typed error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { code: 'activity_notes_limit_reached', message: 'limit' }),
    );

    await expect(
      service.create({ messageId: 'trx-1-0-0', body: 'draft' }),
    ).rejects.toBeInstanceOf(ActivityNotesLimitReachedError);
  });

  it('maps 404 codes to message and note not-found errors', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { code: 'activity_message_not_found' }))
      .mockResolvedValueOnce(jsonResponse(404, { code: 'activity_note_not_found' }));

    await expect(
      service.create({ messageId: 'missing', body: 'draft' }),
    ).rejects.toBeInstanceOf(ActivityMessageNotFoundError);
    await expect(
      service.delete({ messageId: 'trx-1-0-0', noteId: NOTE.noteId }),
    ).rejects.toBeInstanceOf(ActivityNoteNotFoundError);
  });

  it('reports a routing hint for a 404 without a notes error code', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Not Found</html>', { status: 404 }));

    const error = await service
      .list({ messageId: 'trx-1-0-0' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ActivityNotesApiError);
    expect(error).not.toBeInstanceOf(ActivityMessageNotFoundError);
    expect((error as Error).message).toContain('QUERY_API_ORIGIN');
  });

  it('rejects a response that does not match the note shape', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1 }));

    await expect(
      service.create({ messageId: 'trx-1-0-0', body: 'draft' }),
    ).rejects.toThrow('Unexpected activity notes response shape');
  });
});
