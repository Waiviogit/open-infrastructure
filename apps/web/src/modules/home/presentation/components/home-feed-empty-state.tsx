type HomeFeedEmptyStateProps = {
  message: string;
};

export function HomeFeedEmptyState({ message }: HomeFeedEmptyStateProps) {
  return (
    <section className="rounded-card border border-border bg-surface/80 p-card-padding">
      <p className="text-body-sm text-muted">{message}</p>
    </section>
  );
}
