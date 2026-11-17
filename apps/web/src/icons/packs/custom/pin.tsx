import type { IconComponentProps } from '../../types';
import { resolveIconSize } from '../../constants';

/** Stroke width in viewBox units; the legacy 1/76 hairline is invisible at 14–20px. */
const PIN_STROKE_WIDTH = 2.5;

/**
 * Legacy Waivio diagonal push-pin (`public/images/icons/pin-outlined.svg`), viewBox cropped to the glyph.
 * Outline by default; `fill-current` on `className` gives the filled (pinned) look, as with Lucide icons.
 */
export function PinIcon({ size, className, title }: IconComponentProps) {
  const px = resolveIconSize(size);
  const ariaProps = title
    ? { role: 'img' as const, 'aria-hidden': undefined }
    : { 'aria-hidden': true as const };

  return (
    <svg
      width={px}
      height={px}
      viewBox="18 18 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={PIN_STROKE_WIDTH}
      strokeLinejoin="round"
      className={className}
      {...ariaProps}
    >
      {title ? <title>{title}</title> : null}
      <path d="M56.1355 32.5475 43.4466 19.8526C42.7886 20.4988 42.298 21.2123 41.9749 21.9932 41.6519 22.7741 41.4903 23.5729 41.4903 24.3895 41.4903 25.1942 41.6529 25.987 41.9779 26.7679L34.0577 34.6821C33.3918 34.3372 32.6991 34.0776 31.9796 33.9032 31.2601 33.7288 30.5298 33.6415 29.7885 33.6415 28.623 33.6415 27.4953 33.8526 26.4052 34.2748 25.315 34.697 24.3419 35.3342 23.4856 36.1865L30.2344 42.9174 25.9027 47.9032 22.6532 51.8425 20.5988 54.5836C20.1212 55.2892 19.8823 55.753 19.8823 55.975L19.8645 56.0701 19.9002 56.088 19.9002 56.1474 19.9358 56.1058 20.0131 56.1236C20.2351 56.1236 20.6989 55.8888 21.4045 55.419L24.1457 53.3765 28.0849 50.1151 33.0945 45.7775 39.8016 52.5025C40.6579 51.6462 41.2961 50.6731 41.7163 49.5829 42.1365 48.4928 42.3466 47.367 42.3466 46.2056 42.3466 45.4603 42.2603 44.729 42.0879 44.0115 41.9155 43.294 41.6548 42.6003 41.3069 41.9304L49.2202 34.0161C50.0011 34.3372 50.7939 34.4978 51.5986 34.4978 52.4192 34.4978 53.2189 34.3362 53.9979 34.0132 54.7768 33.6901 55.4894 33.2015 56.1355 32.5475Z" />
    </svg>
  );
}
