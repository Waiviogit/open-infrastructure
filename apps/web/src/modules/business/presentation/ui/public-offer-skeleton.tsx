import { ScrollToTopOnEnter } from '@/shared/presentation';

import { businessCardClass } from './classes';

const BAR = 'animate-pulse rounded-btn bg-surface-control';

/** Loading frame of `/offers|requests/:id/versions/:v`: same columns as `PublicOfferPageClient`. */
export function PublicOfferSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-container-page px-gutter py-section-y-sm sm:px-gutter-sm"
      aria-busy="true"
    >
      <ScrollToTopOnEnter routeKey="business-public-offer" />
      <div className={`mb-card-padding h-5 w-32 ${BAR}`} aria-hidden />
      <div
        className="grid items-start gap-card-padding lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]"
        aria-hidden
      >
        <div className="flex min-w-0 flex-col gap-card-padding">
          <div
            className={businessCardClass({ className: 'flex flex-col gap-3' })}
          >
            <div className={`h-4 w-40 ${BAR}`} />
            <div className={`h-8 w-3/4 ${BAR}`} />
            <div className={`h-4 w-1/3 ${BAR}`} />
            <div className={`h-16 w-full ${BAR}`} />
          </div>
          <div
            className={businessCardClass({
              className: 'grid gap-3 sm:grid-cols-2',
            })}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`h-10 ${BAR}`} />
            ))}
          </div>
        </div>
        <div
          className={businessCardClass({ className: 'flex flex-col gap-3' })}
        >
          <div className={`h-5 w-1/2 ${BAR}`} />
          <div className={`h-20 w-full ${BAR}`} />
          <div className={`h-10 w-full ${BAR}`} />
        </div>
      </div>
    </div>
  );
}
