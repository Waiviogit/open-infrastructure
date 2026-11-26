/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import { fireEvent, render } from '@testing-library/react';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    prefetch,
    onMouseEnter,
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean | 'auto' | null;
    onMouseEnter?: () => void;
  }) => (
    <a href={href} data-prefetch={String(prefetch)} onMouseEnter={onMouseEnter}>
      {children}
    </a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

import { ProfilePageLink } from './profile-page-link';

describe('ProfilePageLink', () => {
  it('links to /@account and prefetches the profile head on intent', () => {
    const { container } = render(<ProfilePageLink accountName="alice.b">Alice</ProfilePageLink>);
    const link = container.querySelector('a') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/@alice.b');
    expect(link.getAttribute('data-prefetch')).toBe('auto');

    fireEvent.mouseEnter(link);
    expect(link.getAttribute('data-prefetch')).toBe('true');
  });
});
