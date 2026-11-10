import {
  $parseSerializedNode,
  ElementNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type EditorConfig,
  type LexicalNode,
  type SerializedElementNode,
  Spread,
  createCommand,
  type LexicalCommand,
} from 'lexical';

import { isImageCaptionAlt, POST_IMAGE_CAPTION_CLASS } from '@/shared/domain';

import { pastedImagePayload } from '../pasted-media';

export const POST_IMAGE_NODE_TYPE = 'post-image';

export type ImagePayload = {
  src: string;
  altText?: string;
  cid?: string;
  /** Where a click on the published image goes (`[![alt](src)](linkUrl)`). */
  linkUrl?: string;
};

/** Alt text under the image in the editor, same look and rule as in the published post (not editable text). */
const IMAGE_CAPTION_ATTR = 'data-post-image-caption';

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> =
  createCommand('INSERT_IMAGE_COMMAND');

export type SerializedImageNode = Spread<
  {
    type: typeof POST_IMAGE_NODE_TYPE;
    version: 1;
    src: string;
    altText: string;
    cid: string;
    /** Absent in drafts saved before image links existed. */
    linkUrl?: string;
  },
  SerializedElementNode
>;

function serializedImageNode(payload: ImagePayload): SerializedImageNode {
  return {
    type: POST_IMAGE_NODE_TYPE,
    version: 1,
    src: payload.src,
    altText: payload.altText ?? '',
    cid: payload.cid ?? '',
    linkUrl: payload.linkUrl ?? '',
    children: [],
    format: '',
    indent: 0,
    direction: null,
  };
}

export class ImageNode extends ElementNode {
  __src: string;
  __altText: string;
  __cid: string;
  __linkUrl: string;

  static getType(): string {
    return POST_IMAGE_NODE_TYPE;
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__cid, node.__linkUrl, node.__key);
  }

  constructor(src: string, altText: string, cid: string, linkUrl = '', key?: string) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__cid = cid;
    this.__linkUrl = linkUrl;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-post-image', 'true');
    const className = config.theme.image;
    if (className) {
      wrapper.className = className;
    }
    const img = document.createElement('img');
    img.src = this.__src;
    img.alt = this.__altText;
    img.setAttribute('data-cid', this.__cid);
    img.draggable = false;
    img.className = 'max-w-full h-auto rounded-card';
    wrapper.appendChild(img);
    this.renderCaption(wrapper);
    return wrapper;
  }

  updateDOM(prevNode: ImageNode, dom: HTMLElement): boolean {
    const img = dom.querySelector('img');
    if (img && (prevNode.__src !== this.__src || prevNode.__altText !== this.__altText)) {
      img.src = this.__src;
      img.alt = this.__altText;
      if (this.__cid) {
        img.setAttribute('data-cid', this.__cid);
      }
    }
    if (prevNode.__altText !== this.__altText || prevNode.__linkUrl !== this.__linkUrl) {
      this.renderCaption(dom);
    }
    return false;
  }

  /**
   * Alt text under the image (legacy "image text") unless it is a file name, URL or placeholder —
   * the same rule as the published post. The link is not shown: the image's tooltip names it.
   */
  private renderCaption(wrapper: HTMLElement): void {
    const img = wrapper.querySelector('img');
    if (img) {
      img.title = this.__linkUrl;
    }
    wrapper.querySelector(`[${IMAGE_CAPTION_ATTR}]`)?.remove();
    if (!isImageCaptionAlt(this.__altText)) {
      return;
    }
    const caption = document.createElement('span');
    caption.setAttribute(IMAGE_CAPTION_ATTR, 'true');
    caption.contentEditable = 'false';
    caption.className = `${POST_IMAGE_CAPTION_CLASS} select-none`;
    caption.textContent = this.__altText;
    wrapper.appendChild(caption);
  }

  /** Pasted rich HTML: `<img>` becomes an image block with the original URL. */
  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({ conversion: convertImageElement, priority: 0 }),
    };
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const Klass = this as typeof ImageNode;
    return new Klass(
      serializedNode.src,
      serializedNode.altText ?? '',
      serializedNode.cid ?? '',
      serializedNode.linkUrl ?? '',
    ).updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: POST_IMAGE_NODE_TYPE,
      version: 1,
      src: this.__src,
      altText: this.__altText,
      cid: this.__cid,
      linkUrl: this.__linkUrl,
    };
  }

  getSrc(): string {
    return this.__src;
  }

  getCid(): string {
    return this.__cid;
  }

  getAltText(): string {
    return this.__altText;
  }

  getLinkUrl(): string {
    return this.__linkUrl;
  }

  setSrc(src: string): void {
    const writable = this.getWritable();
    writable.__src = src;
  }

  /** Empty string removes the alt text. */
  setAltText(altText: string): void {
    const writable = this.getWritable();
    writable.__altText = altText;
  }

  /** Empty string removes the link. */
  setLinkUrl(linkUrl: string): void {
    const writable = this.getWritable();
    writable.__linkUrl = linkUrl;
  }

  isInline(): boolean {
    return false;
  }

  canBeEmpty(): boolean {
    return false;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

function convertImageElement(domNode: HTMLElement): DOMConversionOutput {
  const payload = pastedImagePayload(domNode as HTMLImageElement);
  return { node: payload ? $createImageNode(payload) : null };
}

/** Creates an image node via the active editor's registered node class. */
export function $createImageNode(payload: ImagePayload): ImageNode {
  return $parseSerializedNode(
    serializedImageNode(payload),
  ) as ImageNode;
}

export function $isImageNode(
  node: LexicalNode | null | undefined,
): node is ImageNode {
  return node instanceof ImageNode;
}
