import { Injectable, Inject } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../database';
import { KYSELY } from '../database';
import { NewObjectCategoriesRow, ObjectCategoriesRowUpdate } from '@opden-data-layer/odl-db-types';

type DbExecutor = Kysely<Database> | Transaction<Database>;

@Injectable()
export class ObjectCategoriesRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<Database>) {}

  private executor(trx?: DbExecutor): DbExecutor {
    return trx ?? this.db;
  }

  async findByObjectId(objectId: string, trx?: DbExecutor) {
    return this.executor(trx)
      .selectFrom('object_categories')
      .where('object_id', '=', objectId)
      .selectAll()
      .executeTakeFirst();
  }

  async upsert(row: NewObjectCategoriesRow, trx?: DbExecutor): Promise<void> {
    const patch: ObjectCategoriesRowUpdate = {
      meta_group_id: row.meta_group_id,
      category_names: row.category_names,
      updated_at_seq: row.updated_at_seq,
    };
    await this.executor(trx)
      .insertInto('object_categories')
      .values(row)
      .onConflict((oc) => oc.column('object_id').doUpdateSet(patch))
      .execute();
  }
}
