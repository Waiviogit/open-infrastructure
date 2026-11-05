import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';

import type { Database } from '../database';
import { KYSELY } from '../database';

/**
 * Exact lookups of objects by `identifier` update `{ value, type }`.
 * The indexer keeps `(value, type)` globally unique, so one value maps to at most one object.
 */
@Injectable()
export class ObjectIdentifiersRepository {
  private readonly logger = new Logger(ObjectIdentifiersRepository.name);

  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  /**
   * Map of identifier value → object id for the given `type`. Matching is exact
   * (case-sensitive); `lower(...)` only lets Postgres use the identifier prefix index.
   * Returns an empty map on failure so callers treat the lookup as "not found".
   */
  async findObjectIdsByIdentifier(
    identifierType: string,
    values: readonly string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(values.filter((v) => v.length > 0))];
    if (unique.length === 0) {
      return new Map();
    }
    const lowered = unique.map((v) => v.toLowerCase());
    try {
      const rows = await this.db
        .selectFrom('object_updates as ou')
        .innerJoin('objects_core as oc', 'oc.object_id', 'ou.object_id')
        .select([
          'ou.object_id as object_id',
          sql<string>`ou.value_json->>'value'`.as('identifier_value'),
        ])
        .where('ou.update_type', '=', 'identifier')
        .where(sql<boolean>`ou.value_json->>'type' = ${identifierType}`)
        .where(sql<boolean>`lower(ou.value_json->>'value') = ANY(${lowered}::text[])`)
        .where(sql<boolean>`ou.value_json->>'value' = ANY(${unique}::text[])`)
        .orderBy('ou.created_at_unix', 'asc')
        .execute();

      const result = new Map<string, string>();
      for (const row of rows) {
        if (!result.has(row.identifier_value)) {
          result.set(row.identifier_value, row.object_id);
        }
      }
      return result;
    } catch (e) {
      this.logger.error((e as Error).message);
      return new Map();
    }
  }
}
