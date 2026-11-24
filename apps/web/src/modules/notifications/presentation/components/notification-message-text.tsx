'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';

import { messagePlaceholderPattern } from '@/i18n/domain/format-message';

export type NotificationMessageTextProps = {
  template: string;
  params?: Record<string, string>;
  paramHrefs?: Readonly<Record<string, string>>;
};

function renderSegment(
  key: string,
  params: Record<string, string>,
  paramHrefs: Readonly<Record<string, string>>,
  index: number,
): ReactNode {
  const value = params[key] ?? '';
  const href = paramHrefs[key]?.trim();
  if (href) {
    return (
      <Link
        key={`${key}-${index}`}
        href={href}
        className="pointer-events-auto relative z-10 text-accent hover:underline"
      >
        {value}
      </Link>
    );
  }
  return <Fragment key={`${key}-${index}`}>{value}</Fragment>;
}

export function NotificationMessageText({
  template,
  params = {},
  paramHrefs = {},
}: NotificationMessageTextProps) {
  const placeholderPattern = messagePlaceholderPattern();
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segmentIndex = 0;
  while ((match = placeholderPattern.exec(template)) !== null) {
    const [placeholder, key] = match;
    const start = match.index;
    if (start > lastIndex) {
      parts.push(template.slice(lastIndex, start));
    }
    if (key) {
      parts.push(renderSegment(key, params, paramHrefs, segmentIndex));
      segmentIndex += 1;
    } else {
      parts.push(placeholder);
    }
    lastIndex = start + placeholder.length;
  }
  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex));
  }

  return <p className="text-body-sm text-fg leading-body">{parts}</p>;
}
