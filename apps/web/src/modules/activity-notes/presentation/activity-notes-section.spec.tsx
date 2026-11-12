/**
 * @jest-environment jsdom
 */
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import type { ActivityNote } from '../domain/activity-note.types';
import {
  createActivityNoteAction,
  deleteActivityNoteAction,
  deleteAllActivityNotesAction,
} from '../infrastructure/activity-notes.actions';
import { ActivityNotesSection } from './activity-notes-section';

jest.mock('../infrastructure/activity-notes.actions', () => ({
  createActivityNoteAction: jest.fn(),
  updateActivityNoteAction: jest.fn(),
  deleteActivityNoteAction: jest.fn(),
  deleteAllActivityNotesAction: jest.fn(),
}));

jest.mock('./activity-note-composer', () => ({
  ActivityNoteComposer: ({
    submitLabel,
    onSubmit,
  }: {
    submitLabel: string;
    onSubmit: (body: string) => Promise<boolean>;
  }) => (
    <button type="button" onClick={() => void onSubmit('new note')}>
      {submitLabel}
    </button>
  ),
}));

jest.mock('@/shared/presentation', () => ({
  SocialEmbedHtml: ({ html }: { html: string }) => (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  ),
  AppModal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  AppModalCloseButton: ({ onClose, ariaLabel }: { onClose: () => void; ariaLabel: string }) => (
    <button type="button" aria-label={ariaLabel} onClick={onClose}>
      x
    </button>
  ),
}));

const messages = {
  activity_notes_title: 'My notes',
  activity_notes_private_hint: 'Only you can see these notes.',
  activity_notes_count: '{count}/{limit}',
  activity_notes_add: 'Add note',
  activity_notes_edit: 'Edit',
  activity_notes_save: 'Save note',
  activity_notes_delete: 'Delete',
  activity_notes_delete_all: 'Delete all',
  activity_notes_delete_all_confirm_title: 'Delete all notes?',
  activity_notes_delete_all_confirm_body: 'This permanently removes all your notes.',
  activity_notes_limit_reached: 'Note limit reached.',
  activity_notes_error: 'Could not update your notes.',
  activity_notes_import_login: 'Sign in to save this note.',
  cancel: 'Cancel',
  close: 'Close',
} as Messages;

const MESSAGE_ID = 'msg-1';
const LIMIT = 10;

function note(index: number): ActivityNote {
  return {
    noteId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    messageId: MESSAGE_ID,
    body: `Note **${index}**`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function Harness({ initial }: { initial: ActivityNote[] }) {
  const [notes, setNotes] = useState(initial);
  return (
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <ActivityNotesSection
        messageId={MESSAGE_ID}
        viewerUsername="alice"
        notes={notes}
        limit={LIMIT}
        onNotesChange={(update) => setNotes(update)}
      />
    </I18nProvider>
  );
}

const createMock = createActivityNoteAction as jest.MockedFunction<typeof createActivityNoteAction>;
const deleteMock = deleteActivityNoteAction as jest.MockedFunction<typeof deleteActivityNoteAction>;
const deleteAllMock = deleteAllActivityNotesAction as jest.MockedFunction<
  typeof deleteAllActivityNotesAction
>;

describe('ActivityNotesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the count and the Add composer below the limit', () => {
    render(<Harness initial={[note(1), note(2)]} />);
    expect(screen.getByRole('heading', { name: /My notes/ })).toHaveTextContent('2/10');
    expect(screen.getByRole('button', { name: 'Add note' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('hides Add and shows the hint at the limit', () => {
    render(<Harness initial={Array.from({ length: LIMIT }, (_, i) => note(i + 1))} />);
    expect(screen.queryByRole('button', { name: 'Add note' })).not.toBeInTheDocument();
    expect(screen.getByText('Note limit reached.')).toBeInTheDocument();
  });

  it('hides Delete all when there are no notes', () => {
    render(<Harness initial={[]} />);
    expect(screen.queryByRole('button', { name: 'Delete all' })).not.toBeInTheDocument();
  });

  it('appends a created note', async () => {
    createMock.mockResolvedValue({ ok: true, value: note(3) });
    render(<Harness initial={[note(1)]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    });
    expect(createMock).toHaveBeenCalledWith(MESSAGE_ID, 'new note');
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('deletes all notes after the confirm dialog', async () => {
    deleteAllMock.mockResolvedValue({ ok: true, value: null });
    render(<Harness initial={[note(1), note(2)]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    const dialog = screen.getByRole('dialog');
    expect(deleteAllMock).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete all' }));
    });
    expect(deleteAllMock).toHaveBeenCalledWith(MESSAGE_ID);
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('removes one deleted note', async () => {
    deleteMock.mockResolvedValue({ ok: true, value: null });
    render(<Harness initial={[note(1), note(2)]} />);
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    });
    expect(deleteMock).toHaveBeenCalledWith(MESSAGE_ID, note(1).noteId);
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('shows the limit message in an alert when the API rejects the create', async () => {
    createMock.mockResolvedValue({ ok: false, error: { code: 'limit_reached' } });
    render(<Harness initial={[note(1)]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Note limit reached.');
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('shows a generic alert when the action itself rejects', async () => {
    createMock.mockRejectedValue(new Error('500'));
    render(<Harness initial={[]} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not update your notes.');
  });
});
