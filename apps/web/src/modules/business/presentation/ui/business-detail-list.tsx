import type { ReactNode } from 'react';

import { BUSINESS_BREAK_TEXT, businessCardClass } from './classes';

export type BusinessDetailRow = {
  /** React key when labels can repeat (user-defined rows); defaults to the label. */
  id?: string;
  label: string;
  value: ReactNode;
  /** Spans both columns (long text, tables). */
  wide?: boolean;
};

/**
 * A titled card of label / value pairs: the one definition-list look for every Market entity
 * page (contract, invoice, dispute, service order, report). Two columns from `sm`.
 */
export function BusinessDetailSection({
  title,
  rows,
  children,
}: {
  title: string;
  rows: readonly BusinessDetailRow[];
  children?: ReactNode;
}) {
  return (
    <section className={businessCardClass()}>
      <h2 className="text-body font-weight-strong text-heading">{title}</h2>
      {rows.length > 0 ? (
        <dl className="mt-3 grid gap-x-card-padding gap-y-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.id ?? row.label}
              className={`min-w-0 ${row.wide ? 'sm:col-span-2' : ''}`}
            >
              <dt className="text-caption text-fg-secondary">{row.label}</dt>
              <dd
                className={`mt-0.5 text-body-sm text-fg ${BUSINESS_BREAK_TEXT}`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </section>
  );
}
