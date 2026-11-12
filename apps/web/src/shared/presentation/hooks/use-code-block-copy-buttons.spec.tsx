/**
 * @jest-environment jsdom
 */
import { StrictMode, useMemo, useRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { I18nProvider } from '@/i18n/providers/i18n-provider';
import type { LocaleId, Messages } from '@/i18n/types';

import { CODE_BLOCK_WRAPPER_CLASS, useCodeBlockCopyButtons } from './use-code-block-copy-buttons';

const messages = { copy_button: 'Copy', copy_button_copied: 'Copied' } as Messages;

function Html({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const buttons = useCodeBlockCopyButtons(ref, html);
  const innerHtml = useMemo(() => ({ __html: html }), [html]);
  return (
    <>
      <div data-testid="root" ref={ref} dangerouslySetInnerHTML={innerHtml} />
      {buttons}
    </>
  );
}

function renderHtml(html: string) {
  const utils = render(
    <StrictMode>
      <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
        <Html html={html} />
      </I18nProvider>
    </StrictMode>,
  );
  return {
    ...utils,
    rerenderHtml: (next: string) =>
      utils.rerender(
        <StrictMode>
          <I18nProvider locale={'en-US' as LocaleId} messages={messages}>
            <Html html={next} />
          </I18nProvider>
        </StrictMode>,
      ),
  };
}

const TWO_BLOCKS =
  '<p>Intro</p><pre><code>first variant\n</code></pre><p>Mid</p><pre><code>second &lt;b&gt;variant&lt;/b&gt;\nline 2\n</code></pre>';

describe('useCodeBlockCopyButtons', () => {
  let writeText: jest.Mock;

  beforeEach(() => {
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('adds one Copy button per code block, wrapping each once (Strict Mode)', () => {
    renderHtml(TWO_BLOCKS);
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(2);
    const root = screen.getByTestId('root');
    expect(root.querySelectorAll(`.${CODE_BLOCK_WRAPPER_CLASS}`)).toHaveLength(2);
    expect(root.querySelectorAll(`.${CODE_BLOCK_WRAPPER_CLASS} .${CODE_BLOCK_WRAPPER_CLASS}`)).toHaveLength(0);
  });

  it('copies the exact block text (no trailing newline) and shows Copied', async () => {
    renderHtml(TWO_BLOCKS);
    const [, second] = screen.getAllByRole('button', { name: 'Copy' });
    await act(async () => {
      fireEvent.click(second);
    });
    expect(writeText).toHaveBeenCalledWith('second <b>variant</b>\nline 2');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('renders nothing extra without code blocks', () => {
    renderHtml('<p>No code here</p>');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('re-attaches buttons when the html changes', () => {
    const { rerenderHtml } = renderHtml('<p>none</p>');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerenderHtml('<pre><code>a</code></pre><pre><code>b</code></pre><pre><code>c</code></pre>');
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
    rerenderHtml('<pre><code>only</code></pre>');
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(1);
  });

  it('keeps the button idle when the clipboard is unavailable', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    renderHtml('<pre><code>x</code></pre>');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});
