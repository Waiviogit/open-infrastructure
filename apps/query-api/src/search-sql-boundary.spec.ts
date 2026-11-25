import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * R2 — search SQL does not spread: only these files under `apps/query-api/src` may name the search
 * read model table or build a tsquery. Everything else goes through them.
 * @see docs/architecture/adr/search-read-model.md
 */
const ALLOWED_FILES = new Set([
  'repositories/search.repository.ts',
  'repositories/object-search-filters.sql.ts',
]);

const SEARCH_SQL_PATTERN = /object_search_docs|to_tsquery/;
const SPEC_FILE_PATTERN = /\.spec\.tsx?$/;
const SOURCE_FILE_PATTERN = /\.tsx?$/;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }
    return SOURCE_FILE_PATTERN.test(entry.name) &&
      !SPEC_FILE_PATTERN.test(entry.name)
      ? [path]
      : [];
  });
}

describe('search SQL boundary (R2)', () => {
  const srcRoot = __dirname;
  const files = listSourceFiles(srcRoot).map((path) => ({
    rel: relative(srcRoot, path).split(sep).join('/'),
    text: readFileSync(path, 'utf8'),
  }));

  it('scans the app sources', () => {
    expect(files.map((f) => f.rel)).toEqual(
      expect.arrayContaining([...ALLOWED_FILES]),
    );
  });

  it('names object_search_docs or to_tsquery only in the allowed files', () => {
    const offenders = files
      .filter(
        (f) => !ALLOWED_FILES.has(f.rel) && SEARCH_SQL_PATTERN.test(f.text),
      )
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});
