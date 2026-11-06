import {
  $applyNodeReplacement,
  ElementNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type EditorConfig,
  type LexicalNode,
  type SerializedElementNode,
  type Spread,
} from 'lexical';

import { pastedVideoUrl } from '../pasted-media';

import {
  canonicalizeMediaUrl,
  mediaEmbedIframeHtml,
  parseMediaEmbedUrl,
} from '@/shared/infrastructure/media-embed';

export const POST_VIDEO_NODE_TYPE = 'post-video';

export type SerializedVideoNode = Spread<
  {
    type: typeof POST_VIDEO_NODE_TYPE;
    version: 1;
    url: string;
  },
  SerializedElementNode
>;

/**
 * Embedded video player (YouTube, Instagram, TikTok, Facebook, X, LinkedIn) shown
 * in the editor like in the published post. Stored as the canonical public URL;
 * markdown is the bare URL on its own line, which the post renderer embeds.
 */
export class VideoNode extends ElementNode {
  __url: string;

  static getType(): string {
    return POST_VIDEO_NODE_TYPE;
  }

  static clone(node: VideoNode): VideoNode {
    return new VideoNode(node.__url, node.__key);
  }

  constructor(url: string, key?: string) {
    super(key);
    this.__url = url;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-post-video', 'true');
    wrapper.contentEditable = 'false';
    const className = config.theme.video;
    if (typeof className === 'string' && className) {
      wrapper.className = className;
    }
    const parsed = parseMediaEmbedUrl(this.__url);
    if (parsed) {
      // Provider iframe markup shared with the post renderer (escaped, known providers only).
      wrapper.innerHTML = mediaEmbedIframeHtml(parsed);
    }
    return wrapper;
  }

  updateDOM(prevNode: VideoNode): boolean {
    return prevNode.__url !== this.__url;
  }

  /** Pasted rich HTML: a known provider player iframe becomes a video block. */
  static importDOM(): DOMConversionMap | null {
    return {
      iframe: (domNode: HTMLElement) =>
        pastedVideoUrl(domNode as HTMLIFrameElement)
          ? { conversion: convertIframeElement, priority: 1 }
          : null,
    };
  }

  static importJSON(serializedNode: SerializedVideoNode): VideoNode {
    return $createVideoNode(serializedNode.url).updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedVideoNode {
    return {
      ...super.exportJSON(),
      type: POST_VIDEO_NODE_TYPE,
      version: 1,
      url: this.__url,
    };
  }

  getUrl(): string {
    return this.getLatest().__url;
  }

  /** Plain-text editors (comments) and excerpts keep the link. */
  getTextContent(): string {
    return this.getLatest().__url;
  }

  isInline(): boolean {
    return false;
  }

  canBeEmpty(): boolean {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

function convertIframeElement(domNode: HTMLElement): DOMConversionOutput {
  const url = pastedVideoUrl(domNode as HTMLIFrameElement);
  return { node: url ? $createVideoNodeForUrl(url) : null };
}

/** `null` when the URL is not a supported video link. */
export function $createVideoNodeForUrl(url: string): VideoNode | null {
  if (!parseMediaEmbedUrl(url)) {
    return null;
  }
  return $createVideoNode(canonicalizeMediaUrl(url));
}

export function $createVideoNode(url: string): VideoNode {
  return $applyNodeReplacement(new VideoNode(url));
}

export function $isVideoNode(node: LexicalNode | null | undefined): node is VideoNode {
  return node instanceof VideoNode;
}
