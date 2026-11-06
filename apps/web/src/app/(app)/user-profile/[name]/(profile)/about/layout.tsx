import { Suspense } from 'react';

import { RightSidebar } from '@/modules/user-profile';

type AboutLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ name: string }>;
};

async function AboutRightSidebar({ params }: Pick<AboutLayoutProps, 'params'>) {
  const { name } = await params;
  return <RightSidebar accountName={decodeURIComponent(name)} />;
}

export default function UserProfileAboutShellLayout({ children, params }: AboutLayoutProps) {
  return (
    <div
      className={[
        'mt-card-padding grid grid-cols-1 gap-card-padding',
        'lg:grid-cols-[minmax(0,1fr)_minmax(0,var(--shell-right-width))]',
      ].join(' ')}
    >
      <main className="min-h-[12rem] min-w-0">{children}</main>
      <div className="hidden min-w-0 lg:block">
        <Suspense fallback={null}>
          <AboutRightSidebar params={params} />
        </Suspense>
      </div>
    </div>
  );
}
