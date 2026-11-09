import { AppLoader } from '@/shared/presentation';

/** The screen is a client editor: a centered loader while the page reads the session and drafts. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading editor">
      <AppLoader layout="center" />
    </div>
  );
}
