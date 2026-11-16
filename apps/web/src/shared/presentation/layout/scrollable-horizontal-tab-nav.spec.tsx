/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { ScrollableHorizontalTabNav, scrollLeftToReveal } from './scrollable-horizontal-tab-nav';

class MockResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe() {
    this.callback([], this as unknown as ResizeObserver);
  }

  unobserve(): void {
    return undefined;
  }
  disconnect(): void {
    return undefined;
  }
}

beforeAll(() => {
  global.ResizeObserver = MockResizeObserver as typeof ResizeObserver;
});

function mockScrollMetrics(
  element: HTMLElement,
  metrics: { scrollWidth: number; clientWidth: number; scrollLeft?: number },
) {
  Object.defineProperty(element, 'scrollWidth', {
    configurable: true,
    value: metrics.scrollWidth,
  });
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    value: metrics.clientWidth,
  });
  Object.defineProperty(element, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: metrics.scrollLeft ?? 0,
  });
  element.scrollBy = jest.fn();
}

describe('ScrollableHorizontalTabNav', () => {
  it('renders nav with children', () => {
    render(
      <ScrollableHorizontalTabNav
        ariaLabel="Sections"
        rowClass="flex flex-nowrap"
        bleed="none"
      >
        <button type="button">Posts</button>
        <button type="button">Map</button>
      </ScrollableHorizontalTabNav>,
    );

    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Posts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument();
  });

  it('shows scroll arrows when content overflows', () => {
    const { container } = render(
      <ScrollableHorizontalTabNav
        ariaLabel="Sections"
        rowClass="flex flex-nowrap"
        bleed="none"
        scrollPrevAriaLabel="Previous"
        scrollNextAriaLabel="Next"
      >
        <button type="button">Tab A</button>
        <button type="button">Tab B</button>
      </ScrollableHorizontalTabNav>,
    );

    const scrollport = container.querySelector('.overflow-x-auto');
    expect(scrollport).toBeTruthy();
    if (!(scrollport instanceof HTMLElement)) {
      throw new Error('Expected scrollport element');
    }

    mockScrollMetrics(scrollport, { scrollWidth: 400, clientWidth: 200, scrollLeft: 50 });
    fireEvent.scroll(scrollport);

    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('hides scroll arrows when all tabs fit', () => {
    const { container } = render(
      <ScrollableHorizontalTabNav
        ariaLabel="Sections"
        rowClass="flex flex-nowrap"
        bleed="none"
        scrollPrevAriaLabel="Previous"
        scrollNextAriaLabel="Next"
      >
        <button type="button">Tab A</button>
      </ScrollableHorizontalTabNav>,
    );

    const scrollport = container.querySelector('.overflow-x-auto');
    expect(scrollport).toBeTruthy();
    if (!(scrollport instanceof HTMLElement)) {
      throw new Error('Expected scrollport element');
    }

    mockScrollMetrics(scrollport, { scrollWidth: 100, clientWidth: 200, scrollLeft: 0 });
    fireEvent.scroll(scrollport);

    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });

  it('scrolls horizontally when next arrow is clicked', () => {
    const { container } = render(
      <ScrollableHorizontalTabNav
        ariaLabel="Sections"
        rowClass="flex flex-nowrap"
        bleed="none"
        scrollPrevAriaLabel="Previous"
        scrollNextAriaLabel="Next"
      >
        <button type="button">Tab A</button>
        <button type="button">Tab B</button>
      </ScrollableHorizontalTabNav>,
    );

    const scrollport = container.querySelector('.overflow-x-auto');
    expect(scrollport).toBeTruthy();
    if (!(scrollport instanceof HTMLElement)) {
      throw new Error('Expected scrollport element');
    }

    mockScrollMetrics(scrollport, { scrollWidth: 400, clientWidth: 200, scrollLeft: 0 });
    fireEvent.scroll(scrollport);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(scrollport.scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number), behavior: 'smooth' }),
    );
  });

  it('applies gutter bleed even when tabs fit', () => {
    const { container } = render(
      <ScrollableHorizontalTabNav
        ariaLabel="Sections"
        rowClass="flex flex-nowrap"
        bleed="gutter"
      >
        <button type="button">Tab A</button>
      </ScrollableHorizontalTabNav>,
    );

    const root = container.firstElementChild;
    expect(root?.className).toContain('-mx-gutter');
  });

  it('centers tabs with mx-auto when centerWhenNoOverflow is true', () => {
    const { container } = render(
      <ScrollableHorizontalTabNav
        ariaLabel="Sections"
        rowClass="flex flex-nowrap"
        bleed="none"
        centerWhenNoOverflow
      >
        <button type="button">Details</button>
        <button type="button">Reviews</button>
      </ScrollableHorizontalTabNav>,
    );

    const nav = container.querySelector('nav');
    expect(nav?.className).toContain('mx-auto');
    expect(nav?.className).toContain('w-max');
    expect(nav?.className).not.toContain('justify-center');
  });

  it('keeps mx-auto centering when content overflows', () => {
    const { container } = render(
      <ScrollableHorizontalTabNav
        ariaLabel="Sections"
        rowClass="flex flex-nowrap"
        bleed="none"
        centerWhenNoOverflow
      >
        <button type="button">Details</button>
        <button type="button">Reviews</button>
      </ScrollableHorizontalTabNav>,
    );

    const scrollport = container.querySelector('.overflow-x-auto');
    if (!(scrollport instanceof HTMLElement)) {
      throw new Error('Expected scrollport element');
    }

    mockScrollMetrics(scrollport, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 });
    fireEvent.scroll(scrollport);

    const nav = container.querySelector('nav');
    expect(nav?.className).toContain('mx-auto');
    expect(nav?.className).not.toContain('justify-center');
  });
});

describe('scrollLeftToReveal', () => {
  /** Scrollport 600px wide at x=646 (page centered on a wide screen); tabs 104px wide. */
  function setup(tabX: number, scrollLeft = 0) {
    const container = document.createElement('div');
    const target = document.createElement('a');
    container.appendChild(target);
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(container, 'scrollLeft', { configurable: true, value: scrollLeft });
    Object.defineProperty(target, 'offsetWidth', { configurable: true, value: 104 });
    // offsetLeft counts from <body>, not from the scrollport — it must not be used.
    Object.defineProperty(target, 'offsetLeft', { configurable: true, value: 646 + tabX });
    container.getBoundingClientRect = () => ({ left: 646 }) as DOMRect;
    target.getBoundingClientRect = () => ({ left: 646 + tabX - scrollLeft }) as DOMRect;
    return { container, target };
  }

  it('keeps a visible first tab in place on a wide screen', () => {
    const { container, target } = setup(0);
    expect(scrollLeftToReveal(container, target)).toBeNull();
  });

  it('scrolls right just enough to show a tab past the right edge', () => {
    const { container, target } = setup(800);
    expect(scrollLeftToReveal(container, target)).toBe(304);
  });

  it('scrolls back left to a tab before the scrolled-out area', () => {
    const { container, target } = setup(100, 300);
    expect(scrollLeftToReveal(container, target)).toBe(100);
  });
});
