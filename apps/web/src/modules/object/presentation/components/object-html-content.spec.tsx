/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import { HTML_SANDBOX_PERMISSIONS } from '@/modules/object/domain/html-object.constants';

import { ObjectHtmlContent } from './object-html-content';

jest.mock('./object-html-editor', () => ({
  ObjectHtmlEditor: ({ currentSource }: { currentSource: string }) => (
    <div data-testid="html-editor">{currentSource}</div>
  ),
}));

const messages = { object_html_empty: 'This page has no HTML yet.' };

function renderHtmlTab(props: Partial<Parameters<typeof ObjectHtmlContent>[0]>) {
  return render(
    <I18nProvider locale="en-US" messages={messages}>
      <ObjectHtmlContent
        objectId="about-us"
        objectTitle="About Us"
        htmlContent="<h1>Hello</h1>"
        isEditMode={false}
        viewerUsername={null}
        {...props}
      />
    </I18nProvider>,
  );
}

describe('ObjectHtmlContent', () => {
  it('renders the page in a sandbox without same-origin access', () => {
    renderHtmlTab({});
    const frame = screen.getByTitle('About Us');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('sandbox')).toBe(HTML_SANDBOX_PERMISSIONS);
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame.getAttribute('srcdoc')).toContain('<h1>Hello</h1>');
  });

  it('shows the empty state when there is no page', () => {
    renderHtmlTab({ htmlContent: null });
    expect(screen.getByText('This page has no HTML yet.')).toBeTruthy();
    expect(screen.queryByTitle('About Us')).toBeNull();
  });

  it('opens the editor with the current page in edit mode for a signed-in viewer', () => {
    renderHtmlTab({ isEditMode: true, viewerUsername: 'alice' });
    expect(screen.getByTestId('html-editor').textContent).toBe('<h1>Hello</h1>');
    expect(screen.queryByTitle('About Us')).toBeNull();
  });

  it('keeps the page view in edit mode without a signed-in viewer', () => {
    renderHtmlTab({ isEditMode: true, viewerUsername: null });
    expect(screen.queryByTestId('html-editor')).toBeNull();
    expect(screen.getByTitle('About Us')).toBeTruthy();
  });
});
