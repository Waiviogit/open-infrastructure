/** Appends `next` to `prev`, skipping items already listed (ranked pages can repeat an item). */
export function appendUniqueFeedItems<TItem>(
  prev: readonly TItem[],
  next: readonly TItem[],
  getKey: (item: TItem) => string,
): TItem[] {
  const seen = new Set(prev.map(getKey));
  const fresh = next.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return [...prev, ...fresh];
}
