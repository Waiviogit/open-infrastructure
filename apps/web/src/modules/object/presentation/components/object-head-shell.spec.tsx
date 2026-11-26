/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';

import type { ObjectHeroIdentity } from '../../domain/object-page.types';

jest.mock('@/i18n/providers/i18n-provider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const heroProps = jest.fn();
jest.mock('./object-hero', () => ({
  ObjectHero: (props: { title: string; primaryNav: ReactNode }) => {
    heroProps(props);
    return (
      <header>
        <h1>{props.title}</h1>
        {props.primaryNav}
      </header>
    );
  },
}));

jest.mock('./object-page-loading-skeleton', () => ({
  ObjectPageCenterSkeleton: () => <div data-testid="center-skeleton" />,
  ObjectPageLeftRailSkeleton: () => <div data-testid="left-rail-skeleton" />,
  ObjectPagePrimaryNavSkeleton: () => <div data-testid="primary-nav-skeleton" />,
  ObjectPageRightRailSkeleton: () => <div data-testid="right-rail-skeleton" />,
}));

jest.mock('./object-view-shell', () => ({
  ObjectViewShell: ({
    hero,
    leftRail,
    center,
    rightRail,
  }: Record<'hero' | 'leftRail' | 'center' | 'rightRail', ReactNode>) => (
    <div>
      {hero}
      {leftRail}
      {center}
      {rightRail}
    </div>
  ),
}));

import { ObjectHeadShell } from './object-head-shell';

const HEAD: ObjectHeroIdentity = {
  objectId: 'taverna',
  title: 'Taverna',
  subtitleTitle: 'Greek food',
  avatarUrl: 'https://img/a.png',
  coverImageUrl: 'https://img/cover.jpg',
  kindLabel: 'restaurant',
  lifecycleStatus: 'closed',
  displayWeightLabel: '2.4',
  objectTypeKey: 'restaurant',
  showInstacartButton: false,
  previewGallery: [{ url: 'https://img/a.png', rankScore: null, isAvatar: true }],
  galleryAlbums: [],
};

describe('ObjectHeadShell', () => {
  beforeEach(() => heroProps.mockClear());

  it('renders the real hero in pending mode from the head, with the status badge', () => {
    render(<ObjectHeadShell head={HEAD} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Taverna' })).toBeTruthy();
    expect(heroProps).toHaveBeenCalledWith(
      expect.objectContaining({
        pending: true,
        title: 'Taverna',
        subtitleTitle: 'Greek food',
        avatarUrl: 'https://img/a.png',
        coverImageUrl: 'https://img/cover.jpg',
        kindLabel: 'restaurant',
        displayWeightLabel: '2.4',
        statusBadgeLabel: 'object_status_permanently_closed',
        isFollowing: false,
        galleryPhotosAlbum: expect.objectContaining({ name: 'Photos' }),
      }),
    );
  });

  it('keeps tabs, rails and the center column as skeletons', () => {
    render(<ObjectHeadShell head={{ ...HEAD, lifecycleStatus: 'active' }} />);

    expect(heroProps).toHaveBeenCalledWith(expect.objectContaining({ statusBadgeLabel: null }));
    expect(screen.getByLabelText('Loading object content')).toHaveAttribute('aria-busy', 'true');
    for (const id of ['primary-nav-skeleton', 'left-rail-skeleton', 'center-skeleton', 'right-rail-skeleton']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
  });
});
