export type SegmentInput = { id: string; value: number };

export type Segment = SegmentInput & {
  /** Share of the whole, 0–100. */
  share: number;
};

/** Parts of one whole with their shares; parts at zero (or below) are dropped. */
export function toSegments(parts: readonly SegmentInput[]): Segment[] {
  const positive = parts.filter((part) => Number.isFinite(part.value) && part.value > 0);
  const total = positive.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) {
    return [];
  }
  return positive.map((part) => ({ ...part, share: (part.value / total) * 100 }));
}

/** Share label inside a block only when the block is wide enough to hold it. */
export const SEGMENT_MIN_LABEL_SHARE = 12;
