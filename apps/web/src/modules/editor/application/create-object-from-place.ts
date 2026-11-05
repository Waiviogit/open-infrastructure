import type { CustomJsonOp } from '@opden-data-layer/hive-broadcast';

import { buildEditorQuickCreateOps } from '@/modules/object-create/application/build-editor-quick-create-ops';
import { preparePlaceQuickCreate } from '@/modules/object-create/application/build-place-object-fields';

import type { PlaceDetails, PlaceObjectType } from '../domain/place.schema';

/** Fresh id prefixes tried when the random `xxx-name` id is already taken. */
export const PLACE_OBJECT_ID_ATTEMPTS = 3;

export type CreateObjectFromPlacePorts = {
  /** Object already linked to the place; `unknown` when the lookup failed. */
  findObjectForPlace: (
    placeId: string,
  ) => Promise<{ status: 'found'; objectId: string } | { status: 'absent' } | { status: 'unknown' }>;
  /** Uploads the Google photo to IPFS; `null` = no image (never blocks creation). */
  uploadPhoto: (photoUri: string) => Promise<{ cid: string; previewUrl: string } | null>;
  /** `null` = check failed. */
  objectIdExists: (objectId: string) => Promise<boolean | null>;
  broadcast: (operations: CustomJsonOp[]) => Promise<{ transactionId: string }>;
};

export type CreateObjectFromPlaceInput = {
  details: PlaceDetails;
  objectType: PlaceObjectType;
  locale: string;
  username: string;
  odlCustomJsonId: string;
};

export type CreateObjectFromPlaceResult =
  | { kind: 'existing'; objectId: string }
  | { kind: 'created'; objectId: string; transactionId: string; imageUrl: string | null }
  | { kind: 'error'; code: 'service_unavailable' | 'id_taken' | 'broadcast_failed'; message?: string };

/**
 * Creates an ODL object from a Google place with the user's own signature
 * (`custom_json`, no import service). Re-checks the place id right before
 * broadcasting so an object created meanwhile is reused instead of duplicated.
 */
export async function createObjectFromPlace(
  input: CreateObjectFromPlaceInput,
  ports: CreateObjectFromPlacePorts,
): Promise<CreateObjectFromPlaceResult> {
  if (input.details.existing_object_id) {
    return { kind: 'existing', objectId: input.details.existing_object_id };
  }

  const lookup = await ports.findObjectForPlace(input.details.place_id);
  if (lookup.status === 'found') {
    return { kind: 'existing', objectId: lookup.objectId };
  }
  if (lookup.status === 'unknown') {
    return { kind: 'error', code: 'service_unavailable' };
  }

  const photo = input.details.photo_uri ? await ports.uploadPhoto(input.details.photo_uri) : null;

  let prepared: { objectId: string; fields: ReturnType<typeof preparePlaceQuickCreate>['fields'] } | null =
    null;
  for (let attempt = 0; attempt < PLACE_OBJECT_ID_ATTEMPTS && !prepared; attempt += 1) {
    const candidate = preparePlaceQuickCreate({
      details: input.details,
      locale: input.locale,
      imageCid: photo?.cid ?? null,
      objectType: input.objectType,
    });
    const exists = await ports.objectIdExists(candidate.objectId);
    if (exists === null) {
      return { kind: 'error', code: 'service_unavailable' };
    }
    if (!exists) {
      prepared = candidate;
    }
  }
  if (!prepared) {
    return { kind: 'error', code: 'id_taken' };
  }

  const operations = buildEditorQuickCreateOps({
    objectId: prepared.objectId,
    objectType: input.objectType,
    creator: input.username,
    odlCustomJsonId: input.odlCustomJsonId,
    fields: prepared.fields,
    language: input.locale,
  });

  try {
    const { transactionId } = await ports.broadcast(operations);
    return {
      kind: 'created',
      objectId: prepared.objectId,
      transactionId,
      imageUrl: photo?.previewUrl ?? null,
    };
  } catch (error) {
    return {
      kind: 'error',
      code: 'broadcast_failed',
      message: error instanceof Error ? error.message : undefined,
    };
  }
}
