/**
 * Object types whose Details tab shows the featured post (top pin, else newest post) in place of
 * the description.
 * @see docs/apps/web/spec/pages/object/routes/featured-post.md
 */
export const FEATURED_POST_OBJECT_TYPES: readonly string[] = ['recipe'];

export function objectShowsFeaturedPost(objectType: string): boolean {
  return FEATURED_POST_OBJECT_TYPES.includes(objectType.trim());
}
