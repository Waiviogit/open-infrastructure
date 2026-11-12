import { editorBodyToMarkdown } from '@/modules/editor/application/editor-body-to-markdown';
import { objectPagePath } from '@/shared/routes/object-page-path';

import {
  appendObjectAnchorToThreadBody,
  extractTrailingObjectAnchorId,
} from './append-object-anchor-to-thread-body';

describe('appendObjectAnchorToThreadBody', () => {
  it('appends #object_id when id is hashtag-safe', () => {
    expect(appendObjectAnchorToThreadBody('Hello thread', 'waivio')).toBe(
      'Hello thread\n\n#waivio',
    );
  });

  it('returns body only when #object_id already present', () => {
    const body = 'Playing around #hivedev';
    expect(appendObjectAnchorToThreadBody(body, 'hivedev')).toBe(body);
  });

  it('returns body only when /object/ path already present', () => {
    const body = `See ${objectPagePath('waivio')} for details`;
    expect(appendObjectAnchorToThreadBody(body, 'waivio')).toBe(body);
  });

  it('returns #object_id alone for empty body', () => {
    expect(appendObjectAnchorToThreadBody('  ', 'fire-rock')).toBe(
      '#fire-rock',
    );
  });

  it('keeps a single anchor when the editor body already has #object_id', () => {
    const editorJson = JSON.stringify({
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Fresh batch #fire_rock', format: 0 },
            ],
          },
        ],
      },
    });
    const markdown = editorBodyToMarkdown(editorJson, null);
    expect(appendObjectAnchorToThreadBody(markdown, 'fire_rock')).toBe(
      'Fresh batch #fire_rock',
    );
  });

  it('falls back to /object/ path when object id contains a dot', () => {
    expect(appendObjectAnchorToThreadBody('Hello', 'my_object.name')).toBe(
      `Hello\n\n${objectPagePath('my_object.name')}`,
    );
  });
});

describe('extractTrailingObjectAnchorId', () => {
  it('reads a #object_id last paragraph', () => {
    expect(extractTrailingObjectAnchorId('Hello thread\n\n#fire-rock')).toBe(
      'fire-rock',
    );
  });

  it('reads a /object/ path last paragraph and decodes it', () => {
    expect(
      extractTrailingObjectAnchorId(
        `Hello\n\n${objectPagePath('my_object.name')}`,
      ),
    ).toBe('my_object.name');
  });

  it('reads a body that is only the anchor', () => {
    expect(extractTrailingObjectAnchorId('#waivio')).toBe('waivio');
  });

  it('ignores a hashtag inside a sentence', () => {
    expect(
      extractTrailingObjectAnchorId('Playing around #hivedev today'),
    ).toBeNull();
  });

  it('round-trips with appendObjectAnchorToThreadBody', () => {
    const body = appendObjectAnchorToThreadBody('Hello', 'fire_rock');
    expect(extractTrailingObjectAnchorId(body)).toBe('fire_rock');
  });
});
