import { createTranslator } from '@/i18n/domain/create-translator';

import { formatValidityVotePreview } from './format-validity-vote-preview';

describe('formatValidityVotePreview', () => {
  const t = createTranslator(
    {
      object_updates_vote_preview_for_one: '{user} approved',
      object_updates_vote_preview_for_two: '{first} and {second} approved',
      object_updates_vote_preview_for_many:
        '{first}, {second} and {more} more approved',
      object_updates_vote_preview_for_count_one: '{count} approval',
      object_updates_vote_preview_for_count_other: '{count} approvals',
      object_updates_vote_preview_against_one: '{user} rejected',
      object_updates_vote_preview_against_two: '{first} and {second} rejected',
      object_updates_vote_preview_against_many:
        '{first}, {second} and {more} more rejected',
      object_updates_vote_preview_against_count_one: '{count} rejection',
      object_updates_vote_preview_against_count_other: '{count} rejections',
    },
    'en-US',
  );

  it('returns null for zero count', () => {
    expect(formatValidityVotePreview(0, [], t, 'for')).toBeNull();
  });

  it('formats single approve preview', () => {
    expect(formatValidityVotePreview(1, ['alice'], t, 'for')).toBe(
      '@alice approved',
    );
  });

  it('formats multi approve preview', () => {
    expect(formatValidityVotePreview(3, ['alice', 'bob'], t, 'for')).toBe(
      '@alice, @bob and 1 more approved',
    );
  });

  it('picks the plural form when voter names are missing', () => {
    expect(formatValidityVotePreview(1, [], t, 'against')).toBe('1 rejection');
    expect(formatValidityVotePreview(5, [], t, 'for')).toBe('5 approvals');
  });
});
