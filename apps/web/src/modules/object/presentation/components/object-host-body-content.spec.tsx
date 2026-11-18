/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import { HTML_SANDBOX_PERMISSIONS } from '@/modules/object/domain/html-object.constants';
import { hostBodyTabForObjectType } from '@/modules/object/domain/host-body-tab';

import { ObjectHostBodyContent } from './object-host-body-content';

jest.mock('./object-host-body-editor', () => ({
  ObjectHostBodyEditor: ({ currentSource }: { currentSource: string }) => (
    <div data-testid="host-body-editor">{currentSource}</div>
  ),
}));

const messages = {
  object_html_empty: 'This page has no HTML yet.',
  object_page_empty: 'This page has no content yet.',
  object_document_empty: 'This document has no content yet.',
};

function renderTab(
  objectType: string,
  props: Partial<Parameters<typeof ObjectHostBodyContent>[0]>,
) {
  const tab = hostBodyTabForObjectType(objectType);
  if (!tab) {
    throw new Error(`no host body tab for ${objectType}`);
  }
  return render(
    <I18nProvider locale="en-US" messages={messages}>
      <ObjectHostBodyContent
        objectId="obj-1"
        objectTitle="About Us"
        tab={tab}
        body={null}
        isEditMode={false}
        viewerUsername={null}
        {...props}
      />
    </I18nProvider>,
  );
}

describe('ObjectHostBodyContent', () => {
  it('renders an HTML page in a sandbox without same-origin access', () => {
    renderTab('html', { body: '<h1>Hello</h1>' });
    const frame = screen.getByTitle('About Us');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('sandbox')).toBe(HTML_SANDBOX_PERMISSIONS);
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame.getAttribute('srcdoc')).toContain('<h1>Hello</h1>');
  });

  it('renders page markdown as rich text, not in a frame', () => {
    renderTab('page', { body: '## Welcome\n\nHello **world**' });
    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeTruthy();
    expect(screen.getByText('world').tagName).toBe('STRONG');
    expect(screen.queryByTitle('About Us')).toBeNull();
  });

  it.each([
    ['html', 'This page has no HTML yet.'],
    ['page', 'This page has no content yet.'],
    ['legal_document', 'This document has no content yet.'],
  ])('shows the %s empty state', (objectType, text) => {
    renderTab(objectType, { body: '  ' });
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('opens the editor with the current body in edit mode for a signed-in viewer', () => {
    renderTab('legal_document', { body: '# Terms', isEditMode: true, viewerUsername: 'alice' });
    expect(screen.getByTestId('host-body-editor').textContent).toBe('# Terms');
  });

  it('keeps the view in edit mode without a signed-in viewer', () => {
    renderTab('html', { body: '<h1>Hello</h1>', isEditMode: true, viewerUsername: null });
    expect(screen.queryByTestId('host-body-editor')).toBeNull();
    expect(screen.getByTitle('About Us')).toBeTruthy();
  });
});
