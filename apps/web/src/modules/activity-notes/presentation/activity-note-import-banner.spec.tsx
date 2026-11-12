/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import type { ActivityNote } from '../domain/activity-note.types';
import { createActivityNoteAction } from '../infrastructure/activity-notes.actions';
import { ActivityNoteImportBanner } from './activity-note-import-banner';

const openLogin = jest.fn();

jest.mock('@/modules/auth', () => ({
  useLoginModal: () => ({ openLogin }),
}));

jest.mock('../infrastructure/activity-notes.actions', () => ({
  createActivityNoteAction: jest.fn(),
}));

jest.mock('@/shared/presentation', () => ({
  SocialEmbedHtml: ({ html }: { html: string }) => (
    <div data-testid="preview" dangerouslySetInnerHTML={{ __html: html }} />
  ),
}));

const messages = {
  activity_notes_import_title: 'Note from a link',
  activity_notes_import_save: 'Save to my notes',
  activity_notes_import_dismiss: 'Dismiss',
  activity_notes_import_login: 'Sign in to save this note.',
  activity_notes_limit_reached: 'Note limit reached.',
  activity_notes_error: 'Could not update your notes.',
} as Messages;

const MESSAGE_ID = 'msg-1';
const PATH = '/object/obj-1/social/activity/msg-1';
const createMock = createActivityNoteAction as jest.MockedFunction<typeof createActivityNoteAction>;

const SAVED: ActivityNote = {
  noteId: '00000000-0000-4000-8000-000000000001',
  messageId: MESSAGE_ID,
  body: 'Hello',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderBanner(viewerUsername: string | null, onSaved = jest.fn()) {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <ActivityNoteImportBanner
        messageId={MESSAGE_ID}
        viewerUsername={viewerUsername}
        onSaved={onSaved}
      />
    </I18nProvider>,
  );
  return onSaved;
}

describe('ActivityNoteImportBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({ __NA: true }, '', `${PATH}?x=1#note=${encodeURIComponent('**Hello**')}`);
  });

  it('renders nothing without an import hash', () => {
    window.history.replaceState(null, '', PATH);
    renderBanner('alice');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('shows the note preview from the hash', () => {
    renderBanner('alice');
    expect(screen.getByRole('heading', { name: 'Note from a link' })).toBeInTheDocument();
    expect(screen.getByTestId('preview').innerHTML).toContain('<strong>Hello</strong>');
  });

  it('asks a signed-out viewer to log in instead of saving', () => {
    renderBanner(null);
    expect(screen.getByText('Sign in to save this note.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save to my notes' }));
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('saves, reports the note and clears the hash but keeps history state and query', async () => {
    createMock.mockResolvedValue({ ok: true, value: SAVED });
    const onSaved = renderBanner('alice');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save to my notes' }));
    });
    expect(createMock).toHaveBeenCalledWith(MESSAGE_ID, '**Hello**');
    expect(onSaved).toHaveBeenCalledWith(SAVED);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?x=1');
    expect(window.history.state).toEqual({ __NA: true });
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('keeps the banner and shows the limit message when the viewer is at the limit', async () => {
    createMock.mockResolvedValue({ ok: false, error: { code: 'limit_reached' } });
    renderBanner('alice');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save to my notes' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Note limit reached.');
    expect(window.location.hash).not.toBe('');
  });

  it('dismiss clears the hash without saving', () => {
    renderBanner('alice');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(createMock).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
