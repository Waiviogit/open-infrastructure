/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import {
  ActiveFilterChips,
  type ActiveFilterChipItem,
} from './active-filter-chips';

const messages = {
  discover_active_filters: 'Active filters ({count})',
  discover_clear_all: 'Clear all',
} as Messages;

const TRAILING = <button type="button">Filter</button>;

function renderChips(items: ActiveFilterChipItem[], onClearAll = jest.fn()) {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <ActiveFilterChips
        items={items}
        onClearAll={onClearAll}
        trailing={TRAILING}
      />
    </I18nProvider>,
  );
  return { onClearAll };
}

describe('ActiveFilterChips', () => {
  it('renders the count heading, chips and the trailing button last in the chip row', () => {
    const onRemove = jest.fn();
    const { onClearAll } = renderChips([
      {
        key: 'a',
        label: 'Cuisine: German',
        removeLabel: 'Remove German',
        onRemove,
      },
      {
        key: 'b',
        label: 'Map area',
        removeLabel: 'Remove map area',
        onRemove: jest.fn(),
      },
    ]);

    expect(screen.getByText('Active filters (2)')).toBeInTheDocument();
    const filter = screen.getByRole('button', { name: 'Filter' });
    expect(filter.parentElement?.lastElementChild).toBe(filter);

    fireEvent.click(screen.getByRole('button', { name: 'Remove German' }));
    expect(onRemove).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('renders only the trailing button when no filter is active', () => {
    renderChips([]);
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.queryByText(/Active filters/)).not.toBeInTheDocument();
  });
});
