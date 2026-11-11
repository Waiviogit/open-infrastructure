import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  sql,
  type RawBuilder,
} from 'kysely';
import type { OdlDatabase } from '@opden-data-layer/odl-db-types';

import {
  categoryMembershipFilter,
  isEmptyUserFavoritesScope,
  objectFilterClause,
  userFavoritesScopeCte,
  type UserFavoritesScope,
} from './user-favorites-scope.sql';

function compileSql(fragment: RawBuilder<unknown>): {
  sql: string;
  parameters: readonly unknown[];
} {
  const db = new Kysely<OdlDatabase>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return fragment.compile(db);
}

const scope: UserFavoritesScope = {
  account: ' alice ',
  types: ['recipe', 'restaurant'],
  postLinkedTypes: ['restaurant'],
  deselectObjectIds: ['deselected-1'],
};

function compileScope(s: UserFavoritesScope) {
  return compileSql(sql`WITH ${userFavoritesScopeCte(s)} SELECT object_id FROM user_favorites_scope`);
}

describe('userFavoritesScopeCte', () => {
  it('never reads object_ownership (ownership is not part of the Favorites scope)', () => {
    expect(compileScope(scope).sql).not.toMatch(/object_ownership/);
  });

  it('unions object_favorite and post_objects for the trimmed account', () => {
    const compiled = compileScope(scope);
    expect(compiled.sql).toMatch(/from object_favorite fav\s+where fav\.account = \$1/i);
    expect(compiled.sql).toMatch(/from post_objects po\s+where po\.author = \$2/i);
    expect(compiled.parameters.slice(0, 2)).toEqual(['alice', 'alice']);
  });

  it('removes deselected ids from the post-linked branch only', () => {
    const compiled = compileScope(scope);
    const postBranch = compiled.sql.slice(compiled.sql.indexOf('FROM post_objects'));
    expect(postBranch).toMatch(/po\.object_id <> ALL\(\$3::text\[\]\)/);
    const favoriteBranch = compiled.sql.slice(0, compiled.sql.indexOf('FROM post_objects'));
    expect(favoriteBranch).not.toMatch(/<> ALL/);
    expect(compiled.parameters[2]).toEqual(['deselected-1']);
  });

  it('restricts every member to active objects of scope.types', () => {
    const compiled = compileScope(scope);
    expect(compiled.sql).toMatch(/oc\.status = 'active'/);
    expect(compiled.sql).toMatch(/oc\.object_type = ANY\(\$4::text\[\]\)/);
    expect(compiled.parameters[3]).toEqual(['recipe', 'restaurant']);
  });

  it('keeps post-linked members only for postLinkedTypes, favorites for every type', () => {
    const compiled = compileScope(scope);
    expect(compiled.sql).toMatch(
      /\(member\.is_favorite OR oc\.object_type = ANY\(\$5::text\[\]\)\)/,
    );
    expect(compiled.parameters[4]).toEqual(['restaurant']);
  });

  it('binds lists as array parameters, never inlining values', () => {
    const compiled = compileScope({
      ...scope,
      deselectObjectIds: ["x'); DROP TABLE posts; --"],
    });
    expect(compiled.sql).not.toContain('DROP TABLE');
  });
});

describe('isEmptyUserFavoritesScope', () => {
  it('is empty for a blank account or no types', () => {
    expect(isEmptyUserFavoritesScope({ ...scope, account: '  ' })).toBe(true);
    expect(isEmptyUserFavoritesScope({ ...scope, types: [] })).toBe(true);
    expect(isEmptyUserFavoritesScope(scope)).toBe(false);
  });
});

describe('categoryMembershipFilter', () => {
  it('matches the full path with array containment (GIN-eligible)', () => {
    const compiled = compileSql(categoryMembershipFilter(['German Cuisine', 'Comfort Food'], false));
    expect(compiled.sql).toBe('cat.category_names @> $1::text[]');
    expect(compiled.parameters).toEqual([['German Cuisine', 'Comfort Food']]);
  });

  it('matches only objects without categories when uncategorizedOnly', () => {
    const compiled = compileSql(categoryMembershipFilter(['ignored'], true));
    expect(compiled.sql).toMatch(/cat\.category_names IS NULL OR cardinality\(cat\.category_names\) = 0/);
  });

  it('is unrestricted for an empty path', () => {
    expect(compileSql(categoryMembershipFilter([], false)).sql).toBe('TRUE');
  });
});

describe('objectFilterClause', () => {
  it('maps legacy rating threshold 6 to rank_score 6000 (5★ = 10000)', () => {
    const compiled = compileSql(objectFilterClause(sql`s.object_id`, [], 6));
    expect(compiled.sql).toMatch(/>= \$1/);
    expect(compiled.parameters).toEqual([6000]);
  });

  it('ANDs every tag filter', () => {
    const compiled = compileSql(
      objectFilterClause(
        sql`s.object_id`,
        [
          { category: 'Cuisine', value: 'german' },
          { category: 'Diet', value: 'vegan' },
        ],
        null,
      ),
    );
    expect(compiled.sql.match(/EXISTS/g)).toHaveLength(2);
    expect(compiled.sql).toContain(' AND EXISTS');
    expect(compiled.parameters).toEqual(['Cuisine', 'german', 'Diet', 'vegan']);
  });

  it('is TRUE without filters', () => {
    expect(compileSql(objectFilterClause(sql`s.object_id`, [], null)).sql).toBe('TRUE');
  });
});
