/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('@/i18n/providers/i18n-provider', () => ({
  useI18n: () => ({
    t: (key: string) =>
      key === 'object_social_write_post' ? 'Write a post' : key,
  }),
}));

jest.mock('@/modules/editor/domain/post-editor-object-create-return', () => ({
  appendAttachObjectToEditorPath: (_path: string, id: string) => `/editor?attachObject=${id}`,
}));

import { ObjectWritePostPrompt } from './object-write-post-prompt';

describe('ObjectWritePostPrompt', () => {
  it('shows pen label and write post copy for logged-in users', () => {
    render(
      <ObjectWritePostPrompt objectId="waivio" viewerUsername="alice" />,
    );
    expect(screen.getByText('Write a post')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/editor?attachObject=waivio',
    );
  });

  it('uses button when logged out', () => {
    const onRequireLogin = jest.fn();
    render(
      <ObjectWritePostPrompt
        objectId="waivio"
        viewerUsername={null}
        onRequireLogin={onRequireLogin}
      />,
    );
    expect(screen.getByRole('button', { name: /Write a post/i })).toBeInTheDocument();
  });
});
