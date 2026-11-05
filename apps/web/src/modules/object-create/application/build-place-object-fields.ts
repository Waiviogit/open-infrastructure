import { UPDATE_REGISTRY } from '@opden-data-layer/core/update-registry';
import { UPDATE_TYPES } from '@opden-data-layer/core/update-types';

import {
  GOOGLE_MAPS_IDENTIFIER_TYPE,
  type PlaceDetails,
} from '@/modules/editor/domain/place.schema';
import { validateUpdateValue } from '@/modules/object-updates/application/update-value-form.utils';

import { generatePrefix } from '../domain/generate-object-id';
import type { FieldEntry } from '../domain/object-create.types';
import { prepareEditorQuickCreateFields } from './build-editor-quick-create-ops';

export type PlaceObjectFieldsInput = {
  details: PlaceDetails;
  /** Content locale for localizable fields (name, phone, website, hours, image). */
  locale: string;
  /** IPFS CID of the place photo; `null` when there is no photo or upload failed. */
  imageCid: string | null;
};

function entry(updateType: string, value: unknown, locale: string): FieldEntry {
  return { entryKey: `place-${updateType}`, updateType, value, locale };
}

function isValid(field: FieldEntry): boolean {
  const definition = UPDATE_REGISTRY[field.updateType];
  return Boolean(definition) && validateUpdateValue(definition, field.value).success;
}

function addressValue(details: PlaceDetails): Record<string, string> | null {
  if (!details.address) {
    return null;
  }
  const value: Record<string, string> = {};
  for (const [key, raw] of Object.entries(details.address)) {
    const text = raw?.trim();
    if (text) {
      value[key] = text;
    }
  }
  return value;
}

/**
 * ODL fields for an object created from a Google Maps place. Every field is
 * validated against `UPDATE_REGISTRY`; an invalid one (e.g. address without a
 * postal code) is dropped instead of failing the whole create. The
 * `identifier {type:'googleMaps'}` is always present — it is the dedup key.
 */
export function buildPlaceObjectFields(input: PlaceObjectFieldsInput): FieldEntry[] {
  const { details, locale, imageCid } = input;
  const name = details.name.trim();
  const candidates: FieldEntry[] = [
    entry(UPDATE_TYPES.NAME, name, locale),
    entry(UPDATE_TYPES.IDENTIFIER, { type: GOOGLE_MAPS_IDENTIFIER_TYPE, value: details.place_id }, locale),
  ];

  const address = addressValue(details);
  if (address) {
    candidates.push(entry(UPDATE_TYPES.ADDRESS, address, locale));
  }
  if (details.latitude != null && details.longitude != null) {
    candidates.push(
      entry(UPDATE_TYPES.GEO, { latitude: details.latitude, longitude: details.longitude }, locale),
    );
  }
  if (details.phone) {
    candidates.push(entry(UPDATE_TYPES.TELEPHONE, { value: details.phone }, locale));
  }
  if (details.website) {
    candidates.push(entry(UPDATE_TYPES.WEBSITE, { title: name, link: details.website }, locale));
  }
  if (details.work_hours.length > 0) {
    candidates.push(entry(UPDATE_TYPES.WORK_HOURS, details.work_hours.join('\n'), locale));
  }
  if (imageCid) {
    candidates.push(entry(UPDATE_TYPES.IMAGE, { cid: imageCid }, locale));
  }

  return candidates.filter(isValid);
}

/**
 * Object id + full field list (type seeds such as rating / tag categories, then
 * place data) for the editor quick-create broadcast.
 */
export function preparePlaceQuickCreate(
  input: PlaceObjectFieldsInput & { objectType: string },
  objectIdPrefix: string = generatePrefix(),
): { objectId: string; fields: FieldEntry[] } {
  const placeFields = buildPlaceObjectFields(input);
  const placeTypes = new Set(placeFields.map((f) => f.updateType));
  const { objectId, fields: seeds } = prepareEditorQuickCreateFields(
    input.objectType,
    input.locale,
    input.details.name,
    objectIdPrefix,
  );
  return {
    objectId,
    fields: [...seeds.filter((s) => !placeTypes.has(s.updateType)), ...placeFields],
  };
}
