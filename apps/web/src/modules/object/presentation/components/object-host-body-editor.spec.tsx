/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';

import { hashHostBodySource, type HostBodyDraft } from '../../domain/host-body-draft';
import { hostBodyTabForObjectType, type HostBodyTabDefinition } from '../../domain/host-body-tab';
import { createInMemoryHostBodyDraftRepository } from '../../infrastructure/host-body-draft/in-memory-host-body-draft.repository';
import { HOST_BODY_DRAFT_AUTOSAVE_MS } from '../hooks/use-host-body-draft';
import { ObjectHostBodyEditor } from './object-host-body-editor';

/** Minimal Lexical state with one paragraph per line (what the real editor emits). */
function mockLexicalJson(text: string): string {
  return JSON.stringify({
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: null,
      children: text.split('\n').map((line) => ({
        type: 'paragraph',
        version: 1,
        format: '',
        indent: 0,
        direction: null,
        textFormat: 0,
        textStyle: '',
        children: line ? [{ type: 'text', version: 1, text: line, format: 0, style: '', mode: 'normal', detail: 0 }] : [],
      })),
    },
  });
}

function mockTextFromBody(body: string): string {
  try {
    const state = JSON.parse(body) as {
      root: { children: { children: { text: string }[] }[] };
    };
    return state.root.children.map((p) => p.children.map((c) => c.text).join('')).join('\n');
  } catch {
    return body;
  }
}

jest.mock('@/modules/editor', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function LexicalPostEditor({
    initialBody,
    onBodyChange,
  }: {
    initialBody?: string;
    onBodyChange?: (json: string) => void;
  }) {
    const [value, setValue] = React.useState(() => mockTextFromBody(initialBody ?? ''));
    React.useEffect(() => {
      // The real editor emits the body it loaded before any user input.
      onBodyChange?.(mockLexicalJson(value));
    }, []);
    return React.createElement('textarea', {
      'aria-label': 'editor',
      value,
      onChange: (event: { target: { value: string } }) => {
        setValue(event.target.value);
        onBodyChange?.(mockLexicalJson(event.target.value));
      },
    });
  }
  return {
    LexicalPostEditor,
    editorBodyToMarkdown: jest.requireActual('@/modules/editor/application/editor-body-to-markdown')
      .editorBodyToMarkdown,
    isLexicalDraftJson: jest.requireActual('@/modules/editor/application/editor-body-serialization')
      .isLexicalDraftJson,
    hasLexicalDraftBodyContent: jest.requireActual(
      '@/modules/editor/application/editor-body-serialization',
    ).hasLexicalDraftBodyContent,
  };
});
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/config/ipfs-content-base-provider', () => ({ useIpfsContentBaseUrl: () => '' }));
jest.mock('@/config/odl-network-provider', () => ({ useOdlCustomJsonId: () => 'odl-test' }));
jest.mock('@/modules/auth', () => ({ useHydrateWalletProvider: () => undefined }));
jest.mock('@opden-data-layer/hive-broadcast', () => ({
  buildOdlUpdateCreateOp: () => ({ id: 'odl-test', json: '{}' }),
}));
jest.mock('@/modules/object-updates/application/broadcast-odl-op-with-overflow', () => ({
  broadcastOdlOpWithOverflow: jest.fn(async () => ({
    success: true,
    transactionId: 'trx',
    usedIpfsBatch: false,
  })),
}));
jest.mock('@/shared/infrastructure/query/refresh-after-broadcast', () => ({
  refreshAfterBroadcast: jest.fn(async () => undefined),
}));
jest.mock('@/shared/infrastructure/query/revalidate-after-broadcast.server', () => ({
  revalidateObjectAfterBroadcast: jest.fn(async () => undefined),
}));

const messages = {
  object_body_draft_found: 'You have an unsaved draft from {time}.',
  object_body_draft_stale: 'The published version has changed since this draft was saved.',
  object_body_draft_continue: 'Continue',
  object_body_draft_discard: 'Discard',
  object_body_preview: 'Preview',
  object_body_publish: 'Publish',
  object_body_published: 'Update published.',
  object_body_back_to_edit: 'Back to editing',
};

const PUBLISHED = 'Hello world';
const KEY = { username: 'alice', objectId: 'about-us' };

function pageTab(): HostBodyTabDefinition {
  const tab = hostBodyTabForObjectType('page');
  if (!tab) {
    throw new Error('page tab missing');
  }
  return tab;
}

function storedDraft(overrides: Partial<HostBodyDraft> = {}): HostBodyDraft {
  return {
    ...KEY,
    updateType: 'pageContent',
    body: mockLexicalJson('Draft text'),
    baseSourceHash: hashHostBodySource(PUBLISHED),
    updatedAt: Date.UTC(2026, 10, 18, 14, 32),
    ...overrides,
  };
}

async function flush(ms = 0) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function renderEditor(repository = createInMemoryHostBodyDraftRepository()) {
  const view = render(
    <I18nProvider locale="en-US" messages={messages}>
      <ObjectHostBodyEditor
        objectId={KEY.objectId}
        objectTitle="About Us"
        tab={pageTab()}
        currentSource={PUBLISHED}
        viewerUsername={KEY.username}
        draftRepository={repository}
      />
    </I18nProvider>,
  );
  return { ...view, repository };
}

function type(text: string) {
  const editor = screen.getByLabelText('editor');
  fireEvent.keyDown(editor, { key: 'a' });
  fireEvent.change(editor, { target: { value: text } });
}

describe('ObjectHostBodyEditor drafts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens without a banner and does not save the loaded body', async () => {
    const { repository } = renderEditor();
    await flush();

    expect(screen.getByLabelText('editor')).toHaveValue(PUBLISHED);
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();

    await flush(HOST_BODY_DRAFT_AUTOSAVE_MS * 2);
    await expect(repository.load(KEY)).resolves.toBeNull();
  });

  it('saves the edit after the autosave delay', async () => {
    const { repository } = renderEditor();
    await flush();

    type('Hello world, edited');
    await flush(HOST_BODY_DRAFT_AUTOSAVE_MS - 100);
    await expect(repository.load(KEY)).resolves.toBeNull();

    await flush(100);
    const saved = await repository.load(KEY);
    expect(saved).toMatchObject({
      updateType: 'pageContent',
      baseSourceHash: hashHostBodySource(PUBLISHED),
    });
    expect(mockTextFromBody(saved?.body ?? '')).toBe('Hello world, edited');
  });

  it('removes the draft when the edit goes back to the published body', async () => {
    const { repository } = renderEditor();
    await flush();

    type('Hello world, edited');
    await flush(HOST_BODY_DRAFT_AUTOSAVE_MS);
    expect(await repository.load(KEY)).not.toBeNull();

    type(PUBLISHED);
    await flush(HOST_BODY_DRAFT_AUTOSAVE_MS);
    await expect(repository.load(KEY)).resolves.toBeNull();
  });

  it('saves a pending edit when the editor closes', async () => {
    const { repository, unmount } = renderEditor();
    await flush();

    type('Closed before the delay');
    unmount();
    await flush();

    expect(mockTextFromBody((await repository.load(KEY))?.body ?? '')).toBe('Closed before the delay');
  });

  it('shows a stored draft and does not overwrite it while the banner is open', async () => {
    const repository = createInMemoryHostBodyDraftRepository();
    await repository.save(storedDraft());
    renderEditor(repository);
    await flush();

    expect(screen.getByRole('status')).toHaveTextContent('You have an unsaved draft from');
    expect(screen.getByRole('status').querySelector('time')).toHaveAttribute(
      'dateTime',
      '2026-11-18T14:32:00.000Z',
    );
    expect(screen.queryByText(messages.object_body_draft_stale)).toBeNull();

    type('Typed before choosing');
    await flush(HOST_BODY_DRAFT_AUTOSAVE_MS * 2);
    expect(mockTextFromBody((await repository.load(KEY))?.body ?? '')).toBe('Draft text');
  });

  it('Continue loads the draft into the editor and the preview', async () => {
    const repository = createInMemoryHostBodyDraftRepository();
    await repository.save(storedDraft());
    renderEditor(repository);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await flush();

    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getByLabelText('editor')).toHaveValue('Draft text');

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await flush();
    const preview = screen.getByRole('heading', { name: 'Preview' }).closest('section');
    expect(preview?.querySelector('article')).toHaveTextContent('Draft text');
  });

  it('Discard deletes the draft and keeps the published body', async () => {
    const repository = createInMemoryHostBodyDraftRepository();
    await repository.save(storedDraft());
    renderEditor(repository);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await flush();

    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
    expect(screen.getByLabelText('editor')).toHaveValue(PUBLISHED);
    await expect(repository.load(KEY)).resolves.toBeNull();
  });

  it('marks a draft whose published body changed since it was saved', async () => {
    const repository = createInMemoryHostBodyDraftRepository();
    await repository.save(storedDraft({ baseSourceHash: hashHostBodySource('Older body') }));
    renderEditor(repository);
    await flush();

    expect(screen.getByText(messages.object_body_draft_stale)).toBeTruthy();
  });

  it('ignores a draft written for another body update', async () => {
    const repository = createInMemoryHostBodyDraftRepository();
    await repository.save(storedDraft({ updateType: 'legalText' }));
    renderEditor(repository);
    await flush();

    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('deletes the draft after publishing and does not write it again', async () => {
    const { repository } = renderEditor();
    await flush();

    type('Ready to publish');
    await flush(HOST_BODY_DRAFT_AUTOSAVE_MS);
    expect(await repository.load(KEY)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await flush();

    expect(screen.getByText('Update published.')).toBeTruthy();
    await expect(repository.load(KEY)).resolves.toBeNull();
    await flush(HOST_BODY_DRAFT_AUTOSAVE_MS * 2);
    await expect(repository.load(KEY)).resolves.toBeNull();
  });
});
