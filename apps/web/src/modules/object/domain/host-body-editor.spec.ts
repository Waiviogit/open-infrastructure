import { buildHostBodyEditorMarkdown, extractHostBodyFromEditorMarkdown } from './host-body-editor';

describe('host body editor', () => {
  it('seeds an HTML page as one html code block and reads it back', () => {
    const markdown = buildHostBodyEditorMarkdown('html', '<p>x</p>');
    expect(markdown).toBe('```html\n<p>x</p>\n```');
    expect(extractHostBodyFromEditorMarkdown('html', markdown)).toEqual({ ok: true, body: '<p>x</p>' });
  });

  it('keeps HTML errors', () => {
    expect(extractHostBodyFromEditorMarkdown('html', '<p>x</p>')).toEqual({
      ok: false,
      error: 'code_block_required',
    });
  });

  it('seeds rich text as is and publishes the trimmed markdown', () => {
    expect(buildHostBodyEditorMarkdown('markdown', '# Terms\n\nText')).toBe('# Terms\n\nText');
    expect(extractHostBodyFromEditorMarkdown('markdown', '  # Terms\n\nText\n')).toEqual({
      ok: true,
      body: '# Terms\n\nText',
    });
  });

  it('rejects empty rich text', () => {
    expect(extractHostBodyFromEditorMarkdown('markdown', ' \n ')).toEqual({ ok: false, error: 'empty' });
  });
});
