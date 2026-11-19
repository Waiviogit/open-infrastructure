/** Hub TOOLS tab + tools-shell routes (not `/notifications` feed). */
export function isToolsHubPath(pathname: string): boolean {
  return (
    pathname === '/tools' ||
    pathname === '/drafts' ||
    pathname === '/settings' ||
    pathname === '/edit-profile' ||
    pathname.startsWith('/notifications/settings')
  );
}

export type ToolsNavId = 'edit-profile' | 'notifications' | 'drafts' | 'settings';

export function resolveToolsNavId(pathname: string): ToolsNavId {
  if (
    pathname === '/tools' ||
    pathname.startsWith('/notifications/settings')
  ) {
    return 'notifications';
  }
  if (pathname === '/drafts') {
    return 'drafts';
  }
  if (pathname === '/settings') {
    return 'settings';
  }
  if (pathname === '/edit-profile') {
    return 'edit-profile';
  }
  return 'notifications';
}
