import { UPDATE_TYPES } from '@opden-data-layer/core/update-types';

import { formatMessage } from '@/i18n/domain/format-message';
import type { MessageValues } from '@/i18n/types';

import { formatDuplicateRefMessage } from './format-duplicate-ref-message';

const messages: Readonly<Record<string, string>> = {
  object_create_duplicate_user_ref:
    'Account {account} is already listed under {field}.',
  object_create_duplicate_object_ref:
    'Object {object} is already listed under {field}.',
  object_create_duplicate_ref_value: 'Already added.',
};

const t = (key: string, values?: MessageValues) =>
  formatMessage(messages[key] ?? key, values);

describe('formatDuplicateRefMessage', () => {
  it('formats user_ref duplicate with account and field', () => {
    expect(
      formatDuplicateRefMessage(t, UPDATE_TYPES.ADMINS, 'Admins', 'alice'),
    ).toBe('Account alice is already listed under Admins.');
  });

  it('formats object_ref duplicate with object id and field', () => {
    expect(
      formatDuplicateRefMessage(
        t,
        UPDATE_TYPES.IS_RELATED_TO,
        'Related',
        'obj-42',
      ),
    ).toBe('Object obj-42 is already listed under Related.');
  });
});
