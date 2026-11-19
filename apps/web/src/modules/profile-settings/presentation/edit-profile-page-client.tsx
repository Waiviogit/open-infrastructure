'use client';

import type { HiveProfileField } from '@opden-data-layer/hive-broadcast';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import { useHydrateWalletProvider } from '@/modules/auth/presentation/hooks/use-hydrate-wallet-provider';

import { useSaveProfile } from '../application/use-save-profile';
import {
  PROFILE_SOCIAL_ROWS,
  PROFILE_TEXT_FIELDS,
  PROFILE_WALLET_ROWS,
  type ProfileFormValues,
} from '../domain/profile-fields';
import {
  buildProfilePatch,
  profileFieldErrorMessageKey,
  validateProfileForm,
} from '../domain/profile-form.schema';
import { ProfileImageField } from './profile-image-field';
import { PROFILE_INPUT_CLASS, ProfileLinkInputs } from './profile-link-inputs';
import { ProfileSignatureField } from './profile-signature-field';

export type EditProfilePageClientProps = {
  username: string;
  initialValues: ProfileFormValues;
};

function profileValuesKey(values: ProfileFormValues): string {
  return JSON.stringify(values);
}

export function EditProfilePageClient({ username, initialValues }: EditProfilePageClientProps) {
  useHydrateWalletProvider();
  const { t } = useI18n();
  const router = useRouter();
  const { save, pending, errorKey } = useSaveProfile(username);
  const [values, setValues] = useState<ProfileFormValues>(initialValues);
  const initialKey = profileValuesKey(initialValues);
  const seededKeyRef = useRef(initialKey);

  // Re-seed only when the server sends different values (after a save + refresh), so an
  // unrelated `router.refresh()` does not wipe edits in progress.
  useEffect(() => {
    if (seededKeyRef.current === initialKey) {
      return;
    }
    seededKeyRef.current = initialKey;
    setValues(initialValues);
  }, [initialKey, initialValues]);

  const patch = useMemo(() => buildProfilePatch(initialValues, values), [initialValues, values]);
  const fieldErrorCodes = useMemo(
    () => validateProfileForm(initialValues, values),
    [initialValues, values],
  );
  const fieldErrors = useMemo(() => {
    const out: Partial<Record<HiveProfileField, string>> = {};
    for (const [field, code] of Object.entries(fieldErrorCodes) as [
      HiveProfileField,
      NonNullable<(typeof fieldErrorCodes)[HiveProfileField]>,
    ][]) {
      out[field] = t(profileFieldErrorMessageKey(code));
    }
    return out;
  }, [fieldErrorCodes, t]);

  const hasChanges = Object.keys(patch).length > 0;
  const hasErrors = Object.keys(fieldErrorCodes).length > 0;
  const canSave = hasChanges && !hasErrors && !pending;

  const setField = useCallback((field: HiveProfileField, value: string) => {
    setValues((prev) => (prev[field] === value ? prev : { ...prev, [field]: value }));
  }, []);
  const setSignature = useCallback((markdown: string) => setField('signature', markdown), [setField]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    const outcome = await save(patch);
    if (outcome === 'saved') {
      router.push(`/@${username}`);
    }
  };

  return (
    <form className="flex max-w-2xl flex-col gap-6" onSubmit={onSubmit} noValidate>
      <h1 className="font-display text-section font-weight-display text-heading leading-display">
        {t('edit_profile')}
      </h1>

      {PROFILE_TEXT_FIELDS.map((field) => {
        const error = fieldErrors[field.id];
        const errorId = `profile-${field.id}-error`;
        const inputProps = {
          id: `profile-${field.id}`,
          value: values[field.id],
          placeholder: t(field.placeholderKey),
          disabled: pending,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? errorId : undefined,
          className: PROFILE_INPUT_CLASS,
        } as const;
        return (
          <div key={field.id}>
            <label
              htmlFor={`profile-${field.id}`}
              className="mb-2 block text-body font-weight-label text-fg"
            >
              {t(field.labelKey)}
              {field.isPublic ? <span className="text-fg-muted">{t('public_field')}</span> : null}
            </label>
            {field.multiline ? (
              <textarea
                {...inputProps}
                rows={3}
                onChange={(event) => setField(field.id, event.target.value)}
              />
            ) : (
              <input
                {...inputProps}
                type={field.id === 'email' ? 'email' : field.id === 'website' ? 'url' : 'text'}
                onChange={(event) => setField(field.id, event.target.value)}
              />
            )}
            {error ? (
              <p id={errorId} role="alert" className="mt-1 text-caption text-error">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      <ProfileImageField
        kind="avatar"
        username={username}
        value={values.profile_image}
        onChange={(url) => setField('profile_image', url)}
        disabled={pending}
        error={fieldErrors.profile_image}
      />
      <ProfileImageField
        kind="cover"
        username={username}
        value={values.cover_image}
        onChange={(url) => setField('cover_image', url)}
        disabled={pending}
        error={fieldErrors.cover_image}
      />

      <section>
        <h2 className="mb-2 text-body font-weight-label text-fg">{t('profile_social_profiles')}</h2>
        <ProfileLinkInputs
          rows={[...PROFILE_SOCIAL_ROWS, ...PROFILE_WALLET_ROWS]}
          values={values}
          errors={fieldErrors}
          onChange={setField}
          disabled={pending}
        />
      </section>

      <div>
        <ProfileSignatureField
          key={initialKey}
          username={username}
          initialSignature={initialValues.signature}
          value={values.signature}
          onChange={setSignature}
        />
        {fieldErrors.signature ? (
          <p role="alert" className="mt-1 text-caption text-error">
            {fieldErrors.signature}
          </p>
        ) : null}
      </div>

      {errorKey ? (
        <p role="alert" className="text-body-sm text-error">
          {t(errorKey)}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={!canSave}
          aria-busy={pending || undefined}
          className="rounded-btn bg-accent px-6 py-2 text-body font-weight-label text-accent-fg disabled:opacity-50"
        >
          {pending ? t('profile_saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
