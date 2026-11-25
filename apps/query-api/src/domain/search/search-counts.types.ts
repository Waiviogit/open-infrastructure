/** Response DTO: global search counts (`GET /query/v1/search/counts`). */
export interface SearchCountsResponseDto {
  /** Active objects per `object_type` matching query `q`, counted in groups (one per product group). */
  type_counts: Record<string, number>;
  /**
   * True when more documents match than the count cap: every `type_counts` value is then a lower
   * bound (render as `N+`).
   */
  counts_capped: boolean;
  /** Total users matching the name prefix for query `q` (exact). */
  total_users: number;
}
