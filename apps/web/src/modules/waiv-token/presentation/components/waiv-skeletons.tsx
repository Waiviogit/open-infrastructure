import { PRICE_CHART_HEIGHT } from '../charts/price-chart.constants';

const STAT_TILE_COUNT = 6;
const SWAP_ROW_COUNT = 8;
const BREAKDOWN_CARD_COUNT = 4;

export function WaivStatsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="rounded-card border border-border bg-surface p-card-padding">
        <div className="h-5 w-40 animate-pulse rounded-btn bg-surface-control" />
        <div className="mt-2 h-10 w-56 animate-pulse rounded-btn bg-surface-control" />
        <div className="mt-4 h-7 w-72 max-w-full animate-pulse rounded-pill bg-surface-control" />
        <div
          className="mt-4 animate-pulse rounded-card bg-surface-control"
          style={{ height: PRICE_CHART_HEIGHT }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: STAT_TILE_COUNT }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-card bg-surface-control" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: BREAKDOWN_CARD_COUNT }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-card bg-surface-control" />
        ))}
      </div>
    </div>
  );
}

export function WaivSwapsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      {Array.from({ length: SWAP_ROW_COUNT }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-card bg-surface-control" />
      ))}
    </div>
  );
}
