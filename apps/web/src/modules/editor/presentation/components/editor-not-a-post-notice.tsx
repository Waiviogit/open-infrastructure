export type EditorNotAPostNoticeProps = {
  /** Localized `editor_not_a_post_notice`. */
  message: string;
};

/** `/editor?author&permlink` for a comment or thread: those are edited inline where they are posted. */
export function EditorNotAPostNotice({ message }: EditorNotAPostNoticeProps) {
  return (
    <div className="mx-auto max-w-container-content px-gutter py-section-y">
      <p
        className="rounded-card border border-border bg-surface p-card-padding text-body text-fg-secondary"
        role="status"
      >
        {message}
      </p>
    </div>
  );
}
