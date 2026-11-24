import { UPDATE_REGISTRY } from '@opden-data-layer/core/update-registry';

import type { Translate } from '@/i18n/types';

import { normalizeRefFieldValue } from './duplicate-ref-field-values';

export function formatDuplicateRefMessage(
  t: Translate,
  updateType: string,
  fieldLabel: string,
  value: unknown,
): string {
  const def = UPDATE_REGISTRY[updateType];
  const id = normalizeRefFieldValue(value);
  const field = fieldLabel.trim() || updateType;

  if (def?.value_kind === 'user_ref') {
    return t('object_create_duplicate_user_ref', {
      account: id || '—',
      field,
    });
  }
  if (def?.value_kind === 'object_ref') {
    return t('object_create_duplicate_object_ref', {
      object: id || '—',
      field,
    });
  }
  return t('object_create_duplicate_ref_value');
}
