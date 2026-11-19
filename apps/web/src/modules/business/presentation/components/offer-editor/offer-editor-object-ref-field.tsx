'use client';

import { useCallback, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { PlusIcon } from '@/icons';
import { EditorCreateObjectModal } from '@/modules/editor/presentation/components/editor-create-object-modal';
import { ObjectRefSearchField } from '@/modules/object-updates/presentation/components/object-ref-search-field';

import { BusinessButton } from '../../ui/business-button';

const CREATE_ICON_SIZE = 16;

export type OfferEditorObjectRefFieldProps = {
  username: string;
  label: string;
  value: string;
  onChange: (objectId: string) => void;
  objectType: string;
};

export function OfferEditorObjectRefField({
  username,
  label,
  value,
  onChange,
  objectType,
}: OfferEditorObjectRefFieldProps) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreated = useCallback(
    async (objectId: string) => {
      onChange(objectId);
    },
    [onChange],
  );

  return (
    <>
      <div>
        <ObjectRefSearchField
          label={label}
          value={value}
          onChange={(objectId) => onChange(objectId)}
          appliesTo={[objectType]}
        />
        <div className="mt-2 flex justify-end">
          <BusinessButton
            variant="ghost"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon size={CREATE_ICON_SIZE} />
            {t('create_new_object')}
          </BusinessButton>
        </div>
      </div>

      <EditorCreateObjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        username={username}
        initialObjectType={objectType}
        lockObjectType
        onCreated={handleCreated}
      />
    </>
  );
}
