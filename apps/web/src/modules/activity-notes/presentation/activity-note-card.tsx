'use client';

import { useI18n } from '@/i18n/providers/i18n-provider';

import type { ActivityNote } from '../domain/activity-note.types';
import { ActivityNoteBody } from './activity-note-body';

export type ActivityNoteCardProps = {
  note: ActivityNote;
  pending?: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

const ACTION_CLASS =
  'rounded-btn px-2 py-0.5 text-caption text-muted hover:bg-surface-control hover:text-fg-secondary disabled:opacity-50';

export function ActivityNoteCard({ note, pending = false, onEdit, onDelete }: ActivityNoteCardProps) {
  const { t } = useI18n();

  return (
    <article className="rounded-card border border-border bg-surface p-card-padding">
      <ActivityNoteBody markdown={note.body} />
      <footer className="mt-2 flex justify-end gap-1">
        <button type="button" className={ACTION_CLASS} disabled={pending} onClick={onEdit}>
          {t('activity_notes_edit')}
        </button>
        <button type="button" className={ACTION_CLASS} disabled={pending} onClick={onDelete}>
          {t('activity_notes_delete')}
        </button>
      </footer>
    </article>
  );
}
