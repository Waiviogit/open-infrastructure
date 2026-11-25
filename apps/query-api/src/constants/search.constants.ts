/**
 * `GET /search/counts` counts at most this many matching documents (plus one to detect the cap);
 * beyond it the type counts are lower bounds and `counts_capped` is true.
 * @see docs/apps/query-api/spec/search.md
 */
export const SEARCH_COUNTS_MATCH_CAP = 100_000;
