import {
  pastedEmbedPageUrl,
  pastedImagePayload,
  pastedVideoUrl,
} from '../domain/pasted-media';

/**
 * Elements that may hold an image / video block directly. Lexical turns their
 * inline runs into paragraphs and keeps block nodes between them.
 */
const MEDIA_CONTAINER_TAGS: ReadonlySet<string> = new Set([
  'BODY',
  'DIV',
  'SECTION',
  'ARTICLE',
  'MAIN',
  'HEADER',
  'FOOTER',
  'ASIDE',
  'FIGURE',
  'NAV',
]);

/**
 * Paragraph-like and inline wrappers a media element is lifted out of: they are
 * split in two around it (`<p>a<img>b</p>` → `<p>a</p><img><p>b</p>`).
 */
const SPLITTABLE_TAGS: ReadonlySet<string> = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'SPAN',
  'A',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'S',
  'INS',
  'SUB',
  'SUP',
  'MARK',
  'SMALL',
  'FONT',
  'LABEL',
  'CITE',
  'Q',
  'ABBR',
  'PICTURE',
]);

/** Strikethrough tags Lexical does not map itself (it only knows `<s>`). */
const STRIKETHROUGH_TAGS = 'del, strike';
const NBSP = String.fromCharCode(0xa0);
/** `\s` covers the no-break space too. */
const EMPTY_TEXT = /^\s*$/;

function renameElement(el: Element, tagName: string): Element {
  const renamed = el.ownerDocument.createElement(tagName);
  for (const attr of [...el.attributes]) {
    renamed.setAttribute(attr.name, attr.value);
  }
  renamed.append(...el.childNodes);
  el.replaceWith(renamed);
  return renamed;
}

function isEmptyElement(el: Element): boolean {
  return (
    EMPTY_TEXT.test(el.textContent ?? '') &&
    !el.querySelector('img, iframe, hr')
  );
}

function createLink(
  doc: Document,
  href: string,
  text: string,
): HTMLAnchorElement {
  const link = doc.createElement('a');
  link.href = href;
  link.textContent = text;
  return link;
}

/** Closest ancestor that may hold a block, or `null` when a list / table / quote is in the way. */
function mediaContainerOf(el: Element): Element | null {
  let parent = el.parentElement;
  while (parent) {
    if (MEDIA_CONTAINER_TAGS.has(parent.tagName)) {
      return parent;
    }
    if (!SPLITTABLE_TAGS.has(parent.tagName)) {
      return null;
    }
    parent = parent.parentElement;
  }
  return null;
}

/** Moves `media` up to `container`, splitting every wrapper in between around it. */
function liftToContainer(media: Element, container: Element): void {
  let parent = media.parentElement;
  while (parent && parent !== container) {
    const tail = parent.cloneNode(false) as Element;
    while (media.nextSibling) {
      tail.appendChild(media.nextSibling);
    }
    parent.after(media, tail);
    if (isEmptyElement(parent)) {
      parent.remove();
    }
    if (isEmptyElement(tail)) {
      tail.remove();
    }
    parent = media.parentElement;
  }
}

/**
 * Image / video blocks cannot live inside a paragraph, list item, table cell or
 * quote. Lift each one out of paragraph-like wrappers; where it cannot be lifted
 * keep it as a link. Media the editor cannot hold (inline data images, unknown
 * players) become links or are dropped.
 */
function normalizeMedia(doc: Document): void {
  for (const img of [...doc.body.querySelectorAll('img')]) {
    const payload = pastedImagePayload(img);
    if (!payload) {
      img.remove();
      continue;
    }
    const container = mediaContainerOf(img);
    if (container) {
      liftToContainer(img, container);
    } else {
      img.replaceWith(
        createLink(doc, payload.src, payload.altText || payload.src),
      );
    }
  }

  for (const iframe of [...doc.body.querySelectorAll('iframe')]) {
    const videoUrl = pastedVideoUrl(iframe);
    const container = videoUrl ? mediaContainerOf(iframe) : null;
    if (container) {
      liftToContainer(iframe, container);
      continue;
    }
    const pageUrl = videoUrl ?? pastedEmbedPageUrl(iframe);
    if (pageUrl) {
      iframe.replaceWith(createLink(doc, pageUrl, pageUrl));
    } else {
      iframe.remove();
    }
  }
}

/** `<pre><code>…</code></pre>` → one code block; drop the trailing newline renderers add. */
function normalizeCodeBlocks(doc: Document): void {
  for (const pre of [...doc.body.querySelectorAll('pre')]) {
    for (const code of [...pre.querySelectorAll('code')]) {
      code.replaceWith(...code.childNodes);
    }
    const last = pre.lastChild;
    if (last?.nodeType === Node.TEXT_NODE && last.textContent) {
      last.textContent = last.textContent.replace(/\n+$/, '');
    }
  }
}

/** Chrome writes a space at a tag edge as `<span>&nbsp;</span>`; keep a plain space. */
function normalizeSpacerSpans(doc: Document): void {
  for (const span of [...doc.body.querySelectorAll('span')]) {
    if (span.childElementCount === 0 && span.textContent === NBSP) {
      span.replaceWith(doc.createTextNode(' '));
    }
  }
}

/** Empty paragraphs a renderer leaves around embeds (`<p></p><div><iframe>…`). */
function removeEmptyParagraphs(doc: Document): void {
  for (const p of [...doc.body.querySelectorAll('p')]) {
    if (isEmptyElement(p)) {
      p.remove();
    }
  }
}

/**
 * Rewrites clipboard HTML (a rendered post, another Hive front, a web page) in
 * place so Lexical's DOM import yields the same blocks the post shows: image and
 * video blocks, a line, struck text and one code block per `<pre>`.
 */
export function normalizePastedHtml(doc: Document): void {
  for (const el of [...doc.body.querySelectorAll(STRIKETHROUGH_TAGS)]) {
    renameElement(el, 's');
  }
  for (const el of [...doc.body.querySelectorAll('center')]) {
    renameElement(el, 'div');
  }
  normalizeCodeBlocks(doc);
  normalizeMedia(doc);
  normalizeSpacerSpans(doc);
  removeEmptyParagraphs(doc);
}
