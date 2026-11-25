import { UPDATE_TYPES } from '@opden-data-layer/core';
import type {
  AggregatedObject,
  GovernanceSnapshot,
  ObjectViewService,
  ResolvedObjectView,
  VoterWaivPowerMap,
} from '@opden-data-layer/objects-domain';
import type { JsonValue } from '@opden-data-layer/odl-db-types';

import {
  SEARCH_DOC_DEFAULT_LOCALE,
  SEARCH_DOC_DESCRIPTION_MAX_CHARS,
  SEARCH_DOC_LOCALIZED_UPDATE_TYPES,
  SEARCH_DOC_UNMATCHED_LOCALE,
  SEARCH_DOC_UPDATE_TYPES,
  type ObjectSearchDocument,
  type ObjectSearchGeoPoint,
} from './object-search-document';

/** The resolver a document is built with (`ObjectViewService` or a test double). */
export type ObjectViewResolver = Pick<ObjectViewService, 'resolve'>;

/** Coordinates of `geo` updates, keyed by `update_id`. */
export type GeoPointByUpdateId = ReadonlyMap<string, ObjectSearchGeoPoint>;

const SEARCHABLE_STATUS = 'active';

/** Code-unit order: deterministic across runtimes, unlike `localeCompare`. */
function compareCodeUnits(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareCodeUnits);
}

function nonEmptyText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/** Cuts to `maxChars` UTF-16 units without leaving half of a surrogate pair. */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  const cut = text.slice(0, maxChars);
  const lastCode = cut.charCodeAt(cut.length - 1);
  const endsWithHighSurrogate = lastCode >= 0xd800 && lastCode <= 0xdbff;
  return endsWithHighSurrogate ? cut.slice(0, -1) : cut;
}

function jsonStringField(value: JsonValue | null, key: string): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const field = value[key];
  return typeof field === 'string' ? nonEmptyText(field) : null;
}

function winnerText(
  view: ResolvedObjectView,
  updateType: string,
): string | null {
  return nonEmptyText(view.fields[updateType]?.values[0]?.value_text);
}

/**
 * Locales to resolve besides the default: every other locale present on the localizable texts,
 * plus one that matches nothing (the fallback winner). Empty when the texts use a single locale,
 * since the default resolve already falls back to it.
 */
function additionalLocales(aggregated: AggregatedObject): string[] {
  const locales = new Set<string | null>();
  for (const update of aggregated.updates) {
    if (SEARCH_DOC_LOCALIZED_UPDATE_TYPES.includes(update.update_type)) {
      locales.add(update.locale ?? null);
    }
  }
  if (locales.size <= 1) {
    return [];
  }
  const others = [...locales].filter(
    (locale): locale is string =>
      locale !== null && locale !== SEARCH_DOC_DEFAULT_LOCALE,
  );
  return [...others.sort(compareCodeUnits), SEARCH_DOC_UNMATCHED_LOCALE];
}

/**
 * Search document of one object, or `null` when it must not be searchable: the object is not
 * `active`, or the resolver drops it (banned creator). Winners come only from
 * `ObjectViewService.resolve` with the given governance — rejected and losing values never reach
 * the document.
 * @see docs/apps/chain-indexer/spec/object-search-docs.md
 */
export function buildObjectSearchDocument(
  aggregated: AggregatedObject,
  voterWaivPowers: VoterWaivPowerMap,
  governance: GovernanceSnapshot,
  objectViewService: ObjectViewResolver,
  geoByUpdateId: GeoPointByUpdateId,
): ObjectSearchDocument | null {
  const { core } = aggregated;
  if (core.status !== SEARCHABLE_STATUS) {
    return null;
  }

  const [baseView] = objectViewService.resolve([aggregated], voterWaivPowers, {
    update_types: [...SEARCH_DOC_UPDATE_TYPES],
    governance,
    locale: SEARCH_DOC_DEFAULT_LOCALE,
  });
  if (!baseView) {
    return null;
  }

  const localizedViews = [baseView];
  for (const locale of additionalLocales(aggregated)) {
    localizedViews.push(
      ...objectViewService.resolve([aggregated], voterWaivPowers, {
        update_types: [...SEARCH_DOC_LOCALIZED_UPDATE_TYPES],
        governance,
        locale,
      }),
    );
  }

  const collectWinners = (updateType: string): string[] =>
    uniqueSorted(
      localizedViews
        .map((view) => winnerText(view, updateType))
        .filter((text): text is string => text !== null),
    );

  const identifiers = (baseView.fields[UPDATE_TYPES.IDENTIFIER]?.values ?? [])
    .map((update) => jsonStringField(update.value_json, 'value'))
    .filter((value): value is string => value !== null);

  const addressWinner = baseView.fields[UPDATE_TYPES.ADDRESS]?.values[0];
  const geoWinner = baseView.fields[UPDATE_TYPES.GEO]?.values[0];

  return {
    objectId: core.object_id,
    objectType: core.object_type,
    groupKey: core.meta_group_id ?? core.object_id,
    weight: core.weight,
    createdAt: new Date(core.created_at),
    name: winnerText(baseView, UPDATE_TYPES.NAME),
    names: collectWinners(UPDATE_TYPES.NAME),
    titles: collectWinners(UPDATE_TYPES.TITLE),
    descriptions: collectWinners(UPDATE_TYPES.DESCRIPTION).map((text) =>
      truncateText(text, SEARCH_DOC_DESCRIPTION_MAX_CHARS),
    ),
    identifiers: uniqueSorted(identifiers),
    locality: addressWinner
      ? jsonStringField(addressWinner.value_json, 'locality')
      : null,
    geo: geoWinner ? (geoByUpdateId.get(geoWinner.update_id) ?? null) : null,
  };
}
