import { imageContentUrlForCid } from '@/config/ipfs-content-url';

import { editorBodyToMarkdown } from './editor-body-to-markdown';

const CONTENT_BASE = 'https://content.example/';

function imageState(cid: string, src: string): string {
  return JSON.stringify({
    root: {
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Look', format: 1 }],
        },
        { type: 'post-image', cid, src, altText: 'pic', children: [] },
      ],
    },
  });
}

describe('editorBodyToMarkdown', () => {
  it('resolves an uploaded image CID through the IPFS content gateway', () => {
    expect(editorBodyToMarkdown(imageState('QmCid', ''), CONTENT_BASE)).toBe(
      `**Look**\n\n![pic](${imageContentUrlForCid(CONTENT_BASE, 'QmCid')})`,
    );
  });

  it('keeps a pasted image URL when there is no CID', () => {
    expect(
      editorBodyToMarkdown(
        imageState('', ' https://img.example/a.png '),
        CONTENT_BASE,
      ),
    ).toBe('**Look**\n\n![pic](https://img.example/a.png)');
  });

  it('keeps the src when no content base is configured', () => {
    expect(
      editorBodyToMarkdown(
        imageState('QmCid', 'https://img.example/b.png'),
        null,
      ),
    ).toBe('**Look**\n\n![pic](https://img.example/b.png)');
  });

  it('returns an empty string for an empty document', () => {
    expect(
      editorBodyToMarkdown(
        JSON.stringify({
          root: { children: [{ type: 'paragraph', children: [] }] },
        }),
        CONTENT_BASE,
      ),
    ).toBe('');
  });
});
