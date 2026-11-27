'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';

import { PRICE_CHART_HEIGHT } from './price-chart.constants';

import {
  buildTimeTicks,
  formatPointTime,
  formatTimeTick,
} from '../../domain/chart-time-ticks';
import {
  buildPriceChartGeometry,
  nearestPointIndex,
  type ChartPadding,
} from '../../domain/price-chart-scale';
import { formatRatio, formatUsdPrice, formatUsdTick } from '../../domain/waiv-format';
import {
  isIntradayPeriod,
  type WaivChartPeriod,
  type WaivChartPoint,
} from '../../domain/waiv-token.types';

const CHART_HEIGHT = PRICE_CHART_HEIGHT;
/** Width used for the server render; the real width is measured after mount. */
const FALLBACK_WIDTH = 720;
const PADDING: ChartPadding = { top: 12, right: 12, bottom: 30, left: 72 };
const Y_TICK_TARGET = 5;
const X_TICK_MIN_SPACING_PX = 84;
const X_LABEL_OFFSET_PX = 20;
const Y_LABEL_GAP_PX = 10;
const DOT_RADIUS = 4;
const ACTIVE_DOT_RADIUS = 5;
const DOT_RING_WIDTH = 2;
const TOOLTIP_OFFSET_PX = 12;
const DRAW_IN_MS = 650;
const AREA_TOP_OPACITY = 0.18;

type PriceAreaChartProps = {
  /** Oldest first. */
  points: readonly WaivChartPoint[];
  period: WaivChartPeriod;
  /** Refetch in flight: keep the frame, dim the marks. */
  pending: boolean;
  ariaLabel: string;
  emptyLabel: string;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Hand-drawn SVG area chart: gridlines, axes, crosshair, tooltip, keyboard focus. */
export function PriceAreaChart({ points, period, pending, ariaLabel, emptyLabel }: PriceAreaChartProps) {
  const { locale } = useI18n();
  /** State, not a ref object: the observed element changes between the empty state and the chart. */
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const lineRef = useRef<SVGPathElement | null>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const gradientId = `waiv-area-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const intraday = isIntradayPeriod(period);

  useEffect(() => {
    if (!container) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const measured = Math.round(entries[0]?.contentRect.width ?? 0);
      if (measured > 0) {
        setWidth(measured);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);

  useEffect(() => {
    setActiveIndex(null);
    const path = lineRef.current;
    if (!path || typeof path.animate !== 'function' || prefersReducedMotion()) {
      return;
    }
    const animation = path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: DRAW_IN_MS,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
    return () => animation.cancel();
  }, [points]);

  const geometry = useMemo(
    () =>
      buildPriceChartGeometry({
        points,
        width,
        height: CHART_HEIGHT,
        padding: PADDING,
        yTickTarget: Y_TICK_TARGET,
      }),
    [points, width],
  );

  const timeTicks = useMemo(() => {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) {
      return { ticks: [], format: 'day-month' as const };
    }
    const plotWidth = geometry.plot.right - geometry.plot.left;
    return buildTimeTicks(first.time, last.time, Math.floor(plotWidth / X_TICK_MIN_SPACING_PX));
  }, [geometry.plot.left, geometry.plot.right, points]);

  if (points.length < 2) {
    return (
      <div
        ref={setContainer}
        className="flex w-full items-center justify-center rounded-card border border-dashed border-border text-body-sm text-muted"
        style={{ height: CHART_HEIGHT }}
      >
        {emptyLabel}
      </div>
    );
  }

  const { plot } = geometry;
  const lastCoord = geometry.coords[geometry.coords.length - 1];
  const active = activeIndex === null ? null : points[activeIndex];
  const activeCoord = activeIndex === null ? null : geometry.coords[activeIndex];

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * width;
    const first = points[0];
    const last = points[points.length - 1];
    const ratio = (x - plot.left) / (plot.right - plot.left);
    const time = first.time + Math.min(1, Math.max(0, ratio)) * (last.time - first.time);
    setActiveIndex(nearestPointIndex(points, time));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const lastIndex = points.length - 1;
    const current = activeIndex ?? lastIndex;
    const next: Record<string, number | null> = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(lastIndex, current + 1),
      Home: 0,
      End: lastIndex,
      Escape: null,
    };
    if (!(event.key in next)) {
      return;
    }
    event.preventDefault();
    setActiveIndex(next[event.key] ?? null);
  };

  const tooltipOnLeft = activeCoord !== null && activeCoord.x > width / 2;

  return (
    <div
      ref={setContainer}
      className="relative w-full rounded-card outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      style={{ height: CHART_HEIGHT }}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      aria-busy={pending}
      onKeyDown={onKeyDown}
      onBlur={() => setActiveIndex(null)}
    >
      <svg
        width={width}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        className={`block touch-pan-y select-none text-accent transition-opacity duration-200 ${
          pending ? 'opacity-50' : 'opacity-100'
        }`}
        aria-hidden
        onPointerMove={onPointerMove}
        onPointerDown={onPointerMove}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={AREA_TOP_OPACITY} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>

        {geometry.yTicks.map((tick) => {
          const y = geometry.yOf(tick);
          return (
            <g key={`y-${tick}`}>
              <line
                x1={plot.left}
                x2={plot.right}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={plot.left - Y_LABEL_GAP_PX}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted text-caption tabular-nums"
              >
                {formatUsdTick(tick, geometry.yTickDecimals, locale)}
              </text>
            </g>
          );
        })}

        {timeTicks.ticks.map((tick) => {
          const x = geometry.xOf(tick);
          return (
            <text
              key={`x-${tick}`}
              x={x}
              y={plot.bottom + X_LABEL_OFFSET_PX}
              textAnchor="middle"
              className="fill-muted text-caption"
            >
              {formatTimeTick(tick, timeTicks.format, locale)}
            </text>
          );
        })}

        <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
        <path
          ref={lineRef}
          d={geometry.linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
        />

        {activeCoord ? (
          <line
            x1={activeCoord.x}
            x2={activeCoord.x}
            y1={plot.top}
            y2={plot.bottom}
            className="stroke-border-strong"
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
        ) : null}

        {lastCoord && !activeCoord ? (
          <circle
            cx={lastCoord.x}
            cy={lastCoord.y}
            r={DOT_RADIUS}
            fill="currentColor"
            className="stroke-surface"
            strokeWidth={DOT_RING_WIDTH}
          />
        ) : null}

        {activeCoord ? (
          <circle
            cx={activeCoord.x}
            cy={activeCoord.y}
            r={ACTIVE_DOT_RADIUS}
            fill="currentColor"
            className="stroke-surface"
            strokeWidth={DOT_RING_WIDTH}
          />
        ) : null}
      </svg>

      {active && activeCoord ? (
        <div
          role="status"
          className="pointer-events-none absolute z-10 min-w-36 rounded-btn border border-border bg-surface-raised px-3 py-2 shadow-card"
          style={{
            left: activeCoord.x,
            top: Math.max(plot.top, activeCoord.y - TOOLTIP_OFFSET_PX * 3),
            transform: tooltipOnLeft
              ? `translateX(calc(-100% - ${TOOLTIP_OFFSET_PX}px))`
              : `translateX(${TOOLTIP_OFFSET_PX}px)`,
          }}
        >
          <div className="text-body font-weight-strong text-fg tabular-nums">
            {formatUsdPrice(active.usd, locale)}
          </div>
          {active.hive > 0 ? (
            <div className="text-body-sm text-muted tabular-nums">
              {formatRatio(active.hive, locale)} HIVE
            </div>
          ) : null}
          <div className="mt-1 text-caption text-muted">
            {formatPointTime(active.time, intraday, locale)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
