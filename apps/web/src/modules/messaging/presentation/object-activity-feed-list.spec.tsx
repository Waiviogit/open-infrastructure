/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { Messages } from '@/i18n/types';

const mockPushInstantUrl = jest.fn();

jest.mock('@/shared/presentation/navigation', () => ({
  pushInstantUrl: (href: string) => mockPushInstantUrl(href),
  OptimisticNavLink: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/shared/presentation', () => ({
  AppModal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  ModalShellCloseButton: () => null,
  ModalShell: ({
    open,
    children,
    header,
    aside,
  }: {
    open: boolean;
    children: React.ReactNode;
    header?: React.ReactNode;
    aside?: React.ReactNode;
  }) =>
    open ? (
      <div>
        {header}
        {aside}
        {children}
      </div>
    ) : null,
  SocialEmbedHtml: ({ html, className }: { html: string; className?: string }) => (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  ),
  getImagePathPost: (url: string) => url,
  shouldUnoptimizeRemoteImage: () => true,
}));

jest.mock('@/shared/presentation/layout/hooks/use-breakpoint', () => ({
  useMediaQuery: () => false,
}));

import { ObjectActivityFeedList } from './object-activity-feed-list';
import type { MessageItem } from '../domain/messaging.types';

const messages = {
  object_activity_empty: 'No activity yet.',
  object_activity_encrypted_unsupported: 'Encrypted messages are not supported on object activity.',
  object_activity_original_date_caption: 'Originally {datetime}',
  messaging_loading_older: 'Loading older messages...',
  object_activity_open_message_aria: 'Open message',
  object_activity_open_full_page: 'Open full page',
  messaging_action_copy_link: 'Copy link',
} as Messages;

function renderList(items: MessageItem[]) {
  return render(
    <I18nProvider locale="en-US" messages={messages}>
      <ObjectActivityFeedList messages={items} viewerUsername="alice" />
    </I18nProvider>,
  );
}

const baseMessage: MessageItem = {
  message_id: 'm1',
  channel_id: 'obj-ch-1',
  author: 'bob',
  body: 'hello',
  encrypted_body: null,
  encryption: null,
  overflow_ref: null,
  reply_to: null,
  quote_json: null,
  attachments: null,
  mentions: [],
  created_at_unix: 1_700_000_000,
  original_created_at_unix: null,
  updated_at_unix: null,
  source_object: null,
  source: null,
  duplicate_of: null,
  duplicate_count: 1,
};

function messageWithBody(
  body: string,
  createdAtUnix: number,
  messageId: string,
): MessageItem {
  return {
    ...baseMessage,
    message_id: messageId,
    body,
    created_at_unix: createdAtUnix,
  };
}

/** True when `before` node appears above `after` in the document (feed top → bottom). */
function appearsBefore(before: Node, after: Node): boolean {
  return Boolean(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function messageWithStamp(
  body: string,
  createdAtUnix: number,
  originalCreatedAtUnix: number,
  messageId: string,
): MessageItem {
  return {
    ...baseMessage,
    message_id: messageId,
    body,
    created_at_unix: createdAtUnix,
    original_created_at_unix: originalCreatedAtUnix,
  };
}

describe('ObjectActivityFeedList', () => {
  it('sorts by original stamp so Dec 25 ranks above Nov 30 when published same day', () => {
    const published = 1_700_000_000;
    renderList([
      messageWithStamp('Friendly reminder', published, 1_701_302_400, 'm-nov'),
      messageWithStamp('Holiday Hours', published, 1_703_462_400, 'm-dec'),
    ]);

    expect(
      appearsBefore(
        screen.getByText('Holiday Hours'),
        screen.getByText('Friendly reminder'),
      ),
    ).toBe(true);
  });

  it('preserves API newest-first order within a day (newest at top)', () => {
    renderList([
      messageWithBody('newest message', 1_700_010_000, 'm-new'),
      messageWithBody('older message', 1_700_000_000, 'm-old'),
    ]);

    expect(
      appearsBefore(
        screen.getByText('newest message'),
        screen.getByText('older message'),
      ),
    ).toBe(true);
  });

  it('preserves paginated order when older pages are appended (newest stays on top)', () => {
    renderList([
      messageWithBody('initial newest', 1_700_020_000, 'm-init-new'),
      messageWithBody('initial older', 1_700_010_000, 'm-init-old'),
      messageWithBody('loaded oldest', 1_700_000_000, 'm-loaded-old'),
    ]);

    expect(
      appearsBefore(
        screen.getByText('initial newest'),
        screen.getByText('initial older'),
      ),
    ).toBe(true);
    expect(
      appearsBefore(
        screen.getByText('initial older'),
        screen.getByText('loaded oldest'),
      ),
    ).toBe(true);
  });

  it('preserves newest-first order across day groups', () => {
    renderList([
      messageWithBody('today message', 1_700_010_000, 'm-today'),
      messageWithBody('yesterday message', 1_699_000_000, 'm-yesterday'),
    ]);

    expect(
      appearsBefore(
        screen.getByText('today message'),
        screen.getByText('yesterday message'),
      ),
    ).toBe(true);
  });

  it('shows originally caption when stamp is present', () => {
    renderList([
      {
        ...baseMessage,
        original_created_at_unix: 1_262_304_000,
      },
    ]);

    expect(screen.getByText(/Originally/i)).toBeInTheDocument();
    expect(screen.getByText(/Originally Jan 1, 2010/i)).toBeInTheDocument();
  });

  it('shows created time only when stamp is absent', () => {
    renderList([baseMessage]);

    expect(screen.queryByText(/Originally/i)).not.toBeInTheDocument();
  });
});

describe('ObjectActivityFeedList permalink', () => {
  function renderWithObject() {
    return render(
      <I18nProvider locale="en-US" messages={messages}>
        <ObjectActivityFeedList
          messages={[baseMessage]}
          viewerUsername="alice"
          contextObjectId="justin-bellware"
        />
      </I18nProvider>,
    );
  }

  beforeEach(() => {
    mockPushInstantUrl.mockClear();
  });

  it('links the open icon to the message permalink', () => {
    renderWithObject();

    expect(screen.getByRole('link', { name: 'Open message' })).toHaveAttribute(
      'href',
      '/object/justin-bellware/social/activity/m1',
    );
  });

  it('opens the preview modal and pushes the permalink on a plain click', () => {
    renderWithObject();

    fireEvent.click(screen.getByRole('link', { name: 'Open message' }));

    expect(mockPushInstantUrl).toHaveBeenCalledWith('/object/justin-bellware/social/activity/m1');
    expect(screen.getAllByRole('link', { name: 'Open full page' })[0]).toHaveAttribute(
      'href',
      '/object/justin-bellware/social/activity/m1',
    );
  });

  it('leaves modified clicks to the browser (new tab)', () => {
    renderWithObject();

    fireEvent.click(screen.getByRole('link', { name: 'Open message' }), { ctrlKey: true });

    expect(mockPushInstantUrl).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Open full page' })).not.toBeInTheDocument();
  });

  it('has no permalink without an object', () => {
    renderList([baseMessage]);

    expect(screen.queryByRole('link', { name: 'Open message' })).not.toBeInTheDocument();
  });
});

describe('ObjectActivityFeedList reply quote', () => {
  const parent: MessageItem = {
    ...baseMessage,
    message_id: 'p1',
    author: 'insta.agent',
    body: 'Original reel ![cover](https://images.example.com/cover.jpg)',
  };
  const reply: MessageItem = {
    ...baseMessage,
    message_id: 'r1',
    author: 'bob',
    body: 'great reel',
    reply_to: 'p1',
    created_at_unix: 1_700_000_100,
  };

  beforeEach(() => {
    mockPushInstantUrl.mockClear();
  });

  it('shows the quoted parent in the preview modal', () => {
    render(
      <I18nProvider locale="en-US" messages={messages}>
        <ObjectActivityFeedList
          messages={[reply, parent]}
          viewerUsername="alice"
          contextObjectId="justin-bellware"
        />
      </I18nProvider>,
    );

    fireEvent.click(screen.getAllByRole('link', { name: 'Open message' })[0]);

    // Feed row + modal both quote the parent.
    // Quote blocks (feed row + modal), not the parent row's own body.
    expect(screen.getAllByText('Original reel', { selector: 'p.line-clamp-2' })).toHaveLength(2);
  });

  it('resolves the quote from relatedMessages without rendering the parent row', () => {
    const { container } = render(
      <I18nProvider locale="en-US" messages={messages}>
        <ObjectActivityFeedList
          messages={[reply]}
          relatedMessages={[parent]}
          viewerUsername="alice"
          contextObjectId="justin-bellware"
          showOpenPermalink={false}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('Original reel')).toBeInTheDocument();
    expect(container.querySelector('img[src*="cover.jpg"]')).not.toBeNull();
    expect(container.querySelectorAll('[class*="group/message"]')).toHaveLength(1);
  });
});
