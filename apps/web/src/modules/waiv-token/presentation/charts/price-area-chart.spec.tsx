/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';

import { PriceAreaChart } from './price-area-chart';

const CONTAINER_WIDTH = 500;

type Observed = { callback: ResizeObserverCallback; element: Element | null };

describe('PriceAreaChart', () => {
  const observers: Observed[] = [];
  const originalResizeObserver = global.ResizeObserver;

  beforeEach(() => {
    observers.length = 0;
    global.ResizeObserver = class {
      private readonly entry: Observed;
      constructor(callback: ResizeObserverCallback) {
        this.entry = { callback, element: null };
        observers.push(this.entry);
      }
      observe(element: Element) {
        this.entry.element = element;
      }
      unobserve() {
        this.entry.element = null;
      }
      disconnect() {
        this.entry.element = null;
      }
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver;
  });

  function resizeObserved(width: number) {
    act(() => {
      for (const observer of observers) {
        if (observer.element) {
          observer.callback(
            [{ contentRect: { width } } as ResizeObserverEntry],
            {} as ResizeObserver,
          );
        }
      }
    });
  }

  it('fits the container after starting from the empty state', () => {
    const props = { period: '6m' as const, pending: false, ariaLabel: 'chart', emptyLabel: 'empty' };
    const { container, rerender } = render(
      <I18nProvider locale="en-US" messages={{}}>
        <PriceAreaChart {...props} points={[]} />
      </I18nProvider>,
    );

    rerender(
      <I18nProvider locale="en-US" messages={{}}>
        <PriceAreaChart
          {...props}
          points={[
            { time: Date.UTC(2026, 5, 1), usd: 0.012, hive: 0.2 },
            { time: Date.UTC(2026, 5, 2), usd: 0.011, hive: 0.2 },
            { time: Date.UTC(2026, 5, 3), usd: 0.0105, hive: 0.2 },
          ]}
        />
      </I18nProvider>,
    );
    resizeObserved(CONTAINER_WIDTH);

    expect(container.querySelector('svg')?.getAttribute('width')).toBe(String(CONTAINER_WIDTH));
  });
});
