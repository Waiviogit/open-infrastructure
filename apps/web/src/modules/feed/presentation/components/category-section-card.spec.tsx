/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';
import type { CategoryNavLinkProps } from '@/shared/presentation/category-nav';

import type { ProjectedObjectView } from '../../application/dto/object-fields';
import { CategorySectionCard } from './category-section-card';

jest.mock('./object-card', () => ({
  ObjectCard: ({ object }: { object: { object_id: string } }) => (
    <li data-testid="object-card">{object.object_id}</li>
  ),
}));

const messages = {
  profile_shop_object_count_one: '{count} object',
  profile_shop_object_count_other: '{count} objects',
  profile_shop_no_preview: 'No preview items.',
  category_section_show_more: 'Show more {category}',
} as Messages;

function Link({ href, children, className }: CategoryNavLinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

const items = ['a', 'b', 'c'].map((id) => ({ object_id: id }) as unknown as ProjectedObjectView);

function renderCard(totalObjects: number) {
  render(
    <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
      <CategorySectionCard
        headingId="h"
        title="Beauty & Personal Care"
        href="/discover?type=product&cat=Beauty"
        totalObjects={totalObjects}
        items={items}
        NavLink={Link}
      />
    </I18nProvider>,
  );
}

describe('CategorySectionCard', () => {
  it('links the title with a chevron, shows the count, previews and Show more', () => {
    renderCard(746);

    const heading = screen.getByRole('heading', { name: 'Beauty & Personal Care' });
    const titleLink = heading.querySelector('a');
    expect(titleLink).toHaveAttribute('href', '/discover?type=product&cat=Beauty');
    expect(titleLink?.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('746 objects')).toBeInTheDocument();
    expect(screen.getAllByTestId('object-card')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Show more Beauty & Personal Care' })).toHaveAttribute(
      'href',
      '/discover?type=product&cat=Beauty',
    );
  });

  it('has no Show more when every object of the category is previewed', () => {
    renderCard(3);

    expect(screen.queryByRole('link', { name: /Show more/ })).not.toBeInTheDocument();
  });
});
