/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

jest.mock('@/shared/presentation/layout', () => ({
  FeedColumn: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/shared/presentation', () => ({
  useInstantNavigation: () => ({
    navigateInstant: jest.fn(),
    isNavigating: false,
  }),
}));

jest.mock('../../application/actions/resolve-nested-object-content.action', () => ({
  resolveNestedObjectContentAction: jest.fn(),
}));

jest.mock('../../application/actions/resolve-nested-object-path.action', () => ({
  resolveNestedObjectPathAction: jest.fn(),
}));

jest.mock('./object-write-post-prompt', () => ({
  ObjectWritePostPrompt: () => <div data-testid="write-post-prompt" />,
}));

jest.mock('./object-thread-compose-bar', () => ({
  ObjectThreadComposeBar: () => <div data-testid="thread-compose-bar" />,
}));

jest.mock('./object-feed-sub-nav', () => ({
  ObjectFeedSubNav: () => <div data-testid="feed-sub-nav" />,
}));

jest.mock('./object-gallery-tab-content', () => ({
  ObjectGalleryTabContent: () => null,
}));

jest.mock('./object-list-content', () => ({
  ObjectListContent: () => null,
}));

jest.mock('./object-related-album-section', () => ({
  ObjectRelatedAlbumSection: () => null,
}));

jest.mock('./object-center-breadcrumbs', () => ({
  ObjectCenterBreadcrumbs: () => null,
}));

jest.mock('./object-page-content-body', () => ({
  ObjectPageContentBody: () => null,
}));

jest.mock('./object-widget-content', () => ({
  ObjectWidgetContent: ({ config }: { config: { content: string } | null }) =>
    config ? (
      <div data-testid="widget-content">{config.content}</div>
    ) : (
      <div data-testid="widget-empty">empty</div>
    ),
}));

jest.mock('./object-description-body', () => ({
  ObjectDescriptionBody: ({ descriptionContent }: { descriptionContent: string | null }) => (
    <div data-testid="description-body">{descriptionContent ?? 'empty'}</div>
  ),
}));

import { ObjectPrimaryContent } from './object-primary-content';

const EMPTY_NESTED_STACK: never[] = [];

const baseProps = {
  objectId: 'waivio',
  activePrimarySegment: 'social',
  activeFeedSubSegment: 'posts',
  feedSubTabs: [
    { segment: 'posts', label: 'Posts' },
    { segment: 'threads', label: 'Threads' },
    { segment: 'activity', label: 'Activity' },
  ],
  title: 'Waivio',
  objectType: 'default' as const,
  listItems: [],
  initialNestedStack: EMPTY_NESTED_STACK,
  onFeedSubSelect: jest.fn(),
};

describe('ObjectPrimaryContent Social compose chrome', () => {
  it('renders write-review prompt only on Social > Posts', () => {
    render(
      <ObjectPrimaryContent
        {...baseProps}
        objectPostsFeed={<div data-testid="object-posts-feed">Feed</div>}
      />,
    );
    expect(screen.getByTestId('write-post-prompt')).toBeInTheDocument();
    expect(screen.queryByTestId('thread-compose-bar')).not.toBeInTheDocument();
  });

  it('renders thread compose bar only on Social > Threads', () => {
    render(
      <ObjectPrimaryContent
        {...baseProps}
        activeFeedSubSegment="threads"
        objectThreadsFeed={<div data-testid="object-threads-feed">Threads</div>}
      />,
    );
    expect(screen.getByTestId('thread-compose-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('write-post-prompt')).not.toBeInTheDocument();
  });
});

describe('ObjectPrimaryContent Social posts feed', () => {
  it('renders injected object posts feed on Social > Posts', () => {
    render(
      <ObjectPrimaryContent
        {...baseProps}
        objectPostsFeed={<div data-testid="object-posts-feed">Feed</div>}
      />,
    );
    expect(screen.getByTestId('object-posts-feed')).toBeInTheDocument();
    expect(screen.queryByText(/Posts list placeholder/)).not.toBeInTheDocument();
  });

  it('falls back to type content when Social > Posts has no feed slot', () => {
    render(<ObjectPrimaryContent {...baseProps} />);
    expect(screen.getByText(/Social and discussions \(mock\)/)).toBeInTheDocument();
    expect(screen.getByText(/Posts list placeholder/)).toBeInTheDocument();
  });
});

describe('ObjectPrimaryContent Social threads feed', () => {
  it('renders injected object threads feed on Social > Threads', () => {
    render(
      <ObjectPrimaryContent
        {...baseProps}
        activeFeedSubSegment="threads"
        objectThreadsFeed={<div data-testid="object-threads-feed">Threads</div>}
      />,
    );
    expect(screen.getByTestId('object-threads-feed')).toBeInTheDocument();
    expect(screen.queryByText(/Posts list placeholder/)).not.toBeInTheDocument();
  });

  it('falls back to type content when Social > Threads has no feed slot', () => {
    render(
      <ObjectPrimaryContent
        {...baseProps}
        activeFeedSubSegment="threads"
      />,
    );
    expect(screen.getByText(/Social and discussions \(mock\)/)).toBeInTheDocument();
    expect(screen.getByText(/Posts list placeholder/)).toBeInTheDocument();
  });
});

describe('ObjectPrimaryContent activity feed', () => {
  it('renders injected object activity feed on Social > Activity', () => {
    render(
      <ObjectPrimaryContent
        {...baseProps}
        activeFeedSubSegment="activity"
        objectActivityFeed={<div data-testid="object-activity-feed">Activity</div>}
      />,
    );
    expect(screen.getByTestId('object-activity-feed')).toBeInTheDocument();
  });
});

describe('ObjectPrimaryContent details tab', () => {
  it('renders description body on Details tab without nested content', () => {
    render(
      <ObjectPrimaryContent
        {...baseProps}
        activePrimarySegment="details"
        descriptionContent="Catch Kitchen serves modern cuisine."
      />,
    );
    expect(screen.getByTestId('description-body')).toHaveTextContent(
      'Catch Kitchen serves modern cuisine.',
    );
    expect(screen.queryByTestId('feed-sub-nav')).not.toBeInTheDocument();
    expect(screen.queryByTestId('write-post-prompt')).not.toBeInTheDocument();
  });
});

describe('ObjectPrimaryContent widget tab', () => {
  it('renders widget content on widget tab segment', () => {
    render(
      <ObjectPrimaryContent
        {...baseProps}
        activePrimarySegment="widget"
        objectType="widget"
        hostWidgetConfig={{
          column: 'one',
          type: 'Widget',
          content: '<p>podcast embed</p>',
        }}
      />,
    );
    expect(screen.getByTestId('widget-content')).toHaveTextContent('<p>podcast embed</p>');
    expect(screen.queryByText(/Embedded widget \(mock\)/)).not.toBeInTheDocument();
  });

  it('does not render widget tab content on social segment', () => {
    render(
      <ObjectPrimaryContent
        {...baseProps}
        objectType="widget"
        hostWidgetConfig={{
          column: 'one',
          type: 'Widget',
          content: '<p>podcast embed</p>',
        }}
      />,
    );
    expect(screen.queryByTestId('widget-content')).not.toBeInTheDocument();
  });
});
