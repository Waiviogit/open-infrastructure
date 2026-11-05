'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';

import { useOdlCustomJsonId } from '@/config/odl-network-provider';
import { useI18n } from '@/i18n/providers/i18n-provider';
import type { SearchObjectResult } from '@/modules/app-header/domain/search-response.schema';
import { getWalletFacade, useHydrateWalletProvider } from '@/modules/auth';
import { labelForObjectType } from '@/modules/object-create/domain/object-type-display';
import { checkObjectIdExists } from '@/modules/object-create/infrastructure/actions/check-object-id.action';
import { uploadImageFromUrl } from '@/modules/object-create/infrastructure/actions/upload-image-from-url.action';
import { awaitObjectIndexed, awaitTrxConfirmation } from '@/modules/notifications';
import { refreshAfterBroadcast } from '@/shared/infrastructure/query/refresh-after-broadcast';
import { revalidateObjectAfterBroadcast } from '@/shared/infrastructure/query/revalidate-after-broadcast.server';
import { ModalShell, ModalShellCloseButton, MODAL_Z_INDEX_ABOVE_MAP } from '@/shared/presentation';

import {
  createObjectFromPlace,
  type CreateObjectFromPlaceResult,
} from '../../application/create-object-from-place';
import {
  PLACE_OBJECT_TYPES,
  type PlaceDetails,
  type PlaceObjectType,
  type PlaceSearchItem,
} from '../../domain/place.schema';
import { fetchObjectForPlace, fetchPlaceDetails } from '../../infrastructure/places.client';

const TITLE_ID = 'editor-place-create-dialog-title';

type ErrorKey =
  | 'editor_place_error_unavailable'
  | 'editor_place_error_not_found'
  | 'object_create_id_taken'
  | 'editor_place_error_broadcast';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; details: PlaceDetails }
  | { status: 'failed'; errorKey: ErrorKey };

export type EditorPlaceCreateModalProps = {
  place: PlaceSearchItem | null;
  username: string;
  onClose: () => void;
  /** Object to link in the post: the existing one for this place, or the one just created. */
  onResolved: (result: SearchObjectResult) => void;
};

function errorKeyForResult(
  result: Extract<CreateObjectFromPlaceResult, { kind: 'error' }>,
): ErrorKey {
  if (result.code === 'id_taken') {
    return 'object_create_id_taken';
  }
  if (result.code === 'broadcast_failed') {
    return 'editor_place_error_broadcast';
  }
  return 'editor_place_error_unavailable';
}

async function uploadPlacePhoto(
  photoUri: string,
): Promise<{ cid: string; previewUrl: string } | null> {
  try {
    const uploaded = await uploadImageFromUrl(photoUri);
    return 'cid' in uploaded ? uploaded : null;
  } catch {
    return null;
  }
}

/**
 * Confirmation before an object is created from a Google Maps place. The user
 * signs the create; an object already linked to the place is reused instead.
 */
export function EditorPlaceCreateModal({
  place,
  username,
  onClose,
  onResolved,
}: EditorPlaceCreateModalProps) {
  useHydrateWalletProvider();
  const { t, locale } = useI18n();
  const router = useRouter();
  const odlCustomJsonId = useOdlCustomJsonId();
  const typeGroupId = useId();

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [objectType, setObjectType] = useState<PlaceObjectType>('business');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ key: ErrorKey; detail?: string } | null>(null);

  const resolveExisting = useCallback(
    (objectId: string, details: Pick<PlaceDetails, 'name' | 'suggested_object_type'>) => {
      onResolved({
        object_id: objectId,
        object_type: details.suggested_object_type,
        name: details.name,
        image_url: null,
        parent_name: null,
      });
      onClose();
    },
    [onClose, onResolved],
  );

  useEffect(() => {
    if (!place) {
      return;
    }
    if (place.existing_object_id) {
      resolveExisting(place.existing_object_id, place);
      return;
    }
    let cancelled = false;
    setLoad({ status: 'loading' });
    setSubmitError(null);
    setSubmitting(false);
    setObjectType(place.suggested_object_type);
    void fetchPlaceDetails(place.place_id).then((res) => {
      if (cancelled) {
        return;
      }
      if (!res.ok) {
        setLoad({
          status: 'failed',
          errorKey:
            res.error === 'not_found' ? 'editor_place_error_not_found' : 'editor_place_error_unavailable',
        });
        return;
      }
      if (res.details.existing_object_id) {
        resolveExisting(res.details.existing_object_id, res.details);
        return;
      }
      setObjectType(res.details.suggested_object_type);
      setLoad({ status: 'ready', details: res.details });
    });
    return () => {
      cancelled = true;
    };
  }, [place, resolveExisting]);

  const handleConfirm = useCallback(async () => {
    if (load.status !== 'ready' || submitting) {
      return;
    }
    const { details } = load;
    setSubmitting(true);
    setSubmitError(null);

    let result: CreateObjectFromPlaceResult;
    try {
      result = await createObjectFromPlace(
        { details, objectType, locale, username, odlCustomJsonId },
        {
          findObjectForPlace: fetchObjectForPlace,
          uploadPhoto: uploadPlacePhoto,
          objectIdExists: checkObjectIdExists,
          broadcast: (operations) => getWalletFacade().broadcast({ operations }),
        },
      );
    } catch {
      result = { kind: 'error', code: 'service_unavailable' };
    }

    if (result.kind === 'error') {
      setSubmitError({ key: errorKeyForResult(result), detail: result.message });
      setSubmitting(false);
      return;
    }
    if (result.kind === 'existing') {
      resolveExisting(result.objectId, details);
      return;
    }

    const { objectId, transactionId, imageUrl } = result;
    onResolved({
      object_id: objectId,
      object_type: objectType,
      name: details.name,
      image_url: imageUrl,
      parent_name: null,
    });
    onClose();
    void awaitTrxConfirmation(transactionId).finally(async () => {
      await awaitObjectIndexed(objectId);
      await refreshAfterBroadcast(router, () => revalidateObjectAfterBroadcast(objectId));
    });
  }, [
    load,
    submitting,
    objectType,
    locale,
    username,
    odlCustomJsonId,
    resolveExisting,
    onResolved,
    onClose,
    router,
  ]);

  if (!place || place.existing_object_id) {
    return null;
  }

  const details = load.status === 'ready' ? load.details : null;
  const addressLine = details?.formatted_address ?? place.formatted_address;

  const header = (
    <div className="flex items-center justify-between gap-4 border-b border-border px-card-padding py-3">
      <h2 id={TITLE_ID} className="min-w-0 flex-1 font-display text-section text-heading">
        {t('editor_place_create_title')}
      </h2>
      <ModalShellCloseButton
        onClose={onClose}
        disabled={submitting}
        ariaLabel={t('object_edit_cancel')}
      />
    </div>
  );

  const footer = (
    <div className="flex justify-end gap-2 border-t border-border px-card-padding py-3">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="rounded-btn border border-border px-4 py-2 text-body-sm font-weight-label text-fg hover:bg-surface"
      >
        {t('object_edit_cancel')}
      </button>
      <button
        type="button"
        onClick={() => void handleConfirm()}
        disabled={!details || submitting}
        className="rounded-btn bg-accent px-4 py-2 text-body-sm font-weight-label text-accent-fg hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? t('object_edit_submitting') : t('editor_place_create_confirm')}
      </button>
    </div>
  );

  return (
    <ModalShell
      open
      onClose={onClose}
      labelledBy={TITLE_ID}
      zIndex={MODAL_Z_INDEX_ABOVE_MAP}
      maxWidthClass="max-w-container-narrow"
      panelClassName="rounded-card-lg"
      header={header}
      footer={footer}
    >
      <div className="space-y-4 p-card-padding">
        <div className="flex gap-3">
          {details?.photo_uri ? (
            // Short-lived Google photo preview; the stored copy is uploaded to IPFS on confirm.
            <img
              src={details.photo_uri}
              alt=""
              className="h-20 w-20 shrink-0 rounded-card object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div className="min-w-0">
            <p className="font-weight-strong text-body text-fg">{place.name}</p>
            {addressLine ? <p className="text-body-sm text-muted">{addressLine}</p> : null}
            {details?.phone ? <p className="text-body-sm text-fg-secondary">{details.phone}</p> : null}
            {details?.website ? (
              <p className="truncate text-body-sm text-fg-secondary">{details.website}</p>
            ) : null}
          </div>
        </div>

        <p className="text-body-sm text-muted">{t('editor_place_create_description')}</p>

        {load.status === 'loading' ? (
          <p className="text-body-sm text-muted" role="status">
            {t('editor_place_loading')}
          </p>
        ) : null}

        {details ? (
          <fieldset>
            <legend id={typeGroupId} className="text-body-sm text-muted">
              {t('object_create_type_label')}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={typeGroupId}>
              {PLACE_OBJECT_TYPES.map((type) => (
                <label
                  key={type}
                  className={[
                    'cursor-pointer rounded-pill border px-3 py-1 text-body-sm',
                    objectType === type
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-border bg-surface text-fg hover:bg-surface-muted',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name={typeGroupId}
                    value={type}
                    checked={objectType === type}
                    onChange={() => setObjectType(type)}
                    disabled={submitting}
                    className="sr-only"
                  />
                  {labelForObjectType(type)}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {load.status === 'failed' ? (
          <p className="text-body-sm text-error" role="alert">
            {t(load.errorKey)}
          </p>
        ) : null}
        {submitError ? (
          <p className="text-body-sm text-error" role="alert">
            {t(submitError.key)}
            {submitError.detail ? ` ${submitError.detail}` : ''}
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}
