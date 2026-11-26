/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import { fireEvent, render } from '@testing-library/react';

jest.mock('next/link', () => {
  function MockLink({
    children,
    prefetch,
    href,
    onMouseEnter,
    onFocus,
    onTouchStart,
  }: {
    children: ReactNode;
    prefetch?: boolean | 'auto' | null;
    href: string;
    onMouseEnter?: () => void;
    onFocus?: () => void;
    onTouchStart?: () => void;
  }) {
    return (
      <a
        href={href}
        data-prefetch={String(prefetch)}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        onTouchStart={onTouchStart}
      >
        {children}
      </a>
    );
  }
  return {
    __esModule: true,
    default: MockLink,
    useLinkStatus: () => ({ pending: false }),
  };
});

import { ObjectPageLink } from './object-page-link';

function renderLink() {
  const { container } = render(<ObjectPageLink href="/object/photography">photo</ObjectPageLink>);
  return container.querySelector('a') as HTMLAnchorElement;
}

describe('ObjectPageLink', () => {
  it('prefetches only the route shell while merely visible', () => {
    expect(renderLink().getAttribute('data-prefetch')).toBe('auto');
  });

  it.each([
    ['hover', (a: HTMLAnchorElement) => fireEvent.mouseEnter(a)],
    ['focus', (a: HTMLAnchorElement) => fireEvent.focus(a)],
    ['touch', (a: HTMLAnchorElement) => fireEvent.touchStart(a)],
  ])('prefetches the object head on %s', (_name, signal) => {
    const link = renderLink();
    signal(link);
    expect(link.getAttribute('data-prefetch')).toBe('true');
  });
});
