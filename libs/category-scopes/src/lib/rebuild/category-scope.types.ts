export type UserCategoryScopeAggOptions = {
  account: string;
  /** The single category object type of this scope (`objects_core.object_type`). */
  objectType: string;
  /** When false, the post-linked branch contributes no rows. */
  includePostObjects: boolean;
  /** `user_shop_deselect` object ids; excluded from the post-linked branch only. */
  deselectIds: readonly string[];
};

/**
 * What a scope rebuild did:
 * - `rebuilt` — rows replaced (possibly with none, for an empty scope);
 * - `legacy_deleted` — a user key that is not `account:categoryType`; its rows were deleted;
 * - `not_category_type` — a type scope for a type without `category` updates; nothing written.
 */
export type CategoryScopeRebuildOutcome =
  | 'rebuilt'
  | 'legacy_deleted'
  | 'not_category_type';
