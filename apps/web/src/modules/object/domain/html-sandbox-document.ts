import { HTML_SANDBOX_MESSAGE_SOURCE } from './html-object.constants';

const HEAD_OPEN_TAG_REGEX = /<head(?:\s[^>]*)?>/i;
const HTML_OPEN_TAG_REGEX = /<html(?:\s[^>]*)?>/i;
const STYLE_BLOCK_REGEX = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi;
const STYLE_ATTRIBUTE_REGEX = /(\sstyle\s*=\s*)("[^"]*"|'[^']*')/gi;
/** A `vh` length (`100vh`, `-50vh`, `.5dvh`), not part of a name such as `.h-100vh`. */
const VIEWPORT_HEIGHT_VALUE_REGEX = /(?<![\w.-])(-?(?:\d+\.?\d*|\.\d+))[sld]?vh\b/gi;

/** CSS variable holding 1% of the app window height; replaces `vh` inside the sandbox. */
export const HTML_SANDBOX_VH_VARIABLE = '--odl-vh';

function replaceViewportHeightUnits(css: string): string {
  return css.replace(
    VIEWPORT_HEIGHT_VALUE_REGEX,
    (_match, amount: string) => `calc(var(${HTML_SANDBOX_VH_VARIABLE}) * ${amount})`,
  );
}

/**
 * Inside an auto-sized frame `vh` is a share of the frame, so a `100vh` section grows the frame,
 * which grows the section, forever. In the page's CSS (`<style>` blocks and `style` attributes)
 * `vh` becomes a share of the app window instead, as if the page were open in its own tab.
 */
export function rewriteViewportHeightUnits(source: string): string {
  return source
    .replace(
      STYLE_BLOCK_REGEX,
      (_match, open: string, css: string, close: string) =>
        `${open}${replaceViewportHeightUnits(css)}${close}`,
    )
    .replace(
      STYLE_ATTRIBUTE_REGEX,
      (_match, prefix: string, quoted: string) => `${prefix}${replaceViewportHeightUnits(quoted)}`,
    );
}

/**
 * Runs first inside the sandbox:
 * - links leave the frame in a new tab (the sandbox has no top navigation);
 * - `--odl-vh` is 1% of the app window height (built in, then updated by the parent on resize);
 * - the frame never scrolls itself: it is always as tall as its content;
 * - the content height is posted to the parent whenever it changes, with `complete` once the page
 *   (images, fonts) has loaded.
 *
 * The height is the bottom of the body's children, not `scrollHeight`: `scrollHeight` never drops
 * below the frame's own height, so the frame could grow but never shrink back.
 */
function bootstrapScript(viewportHeight: number): string {
  return `<script>(function(){
var SOURCE=${JSON.stringify(HTML_SANDBOX_MESSAGE_SOURCE)};
var VH=${JSON.stringify(HTML_SANDBOX_VH_VARIABLE)};
var root=document.documentElement;
function setVh(h){if(h>0){root.style.setProperty(VH,(h/100)+'px');}}
setVh(${JSON.stringify(viewportHeight)});
root.style.setProperty('overflow','hidden','important');
document.addEventListener('click',function(e){
var t=e.target;var a=t&&t.closest?t.closest('a[href]'):null;if(!a)return;
var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'||/^javascript:/i.test(h))return;
var g=(a.getAttribute('target')||'').toLowerCase();
if(g===''||g==='_self'||g==='_top'||g==='_parent'){a.setAttribute('target','_blank');}
a.setAttribute('rel','noopener noreferrer');
},true);
function px(v){return parseFloat(v)||0;}
function measure(){
var b=document.body;if(!b||!b.children.length){return Math.ceil(root.scrollHeight);}
var bottom=0;
for(var i=0;i<b.children.length;i++){var el=b.children[i];var cs=getComputedStyle(el);
if(cs.display==='none'||cs.position==='fixed'){continue;}
var r=el.getBoundingClientRect();if(r.bottom+px(cs.marginBottom)>bottom){bottom=r.bottom+px(cs.marginBottom);}}
var bs=getComputedStyle(b);
return Math.ceil(bottom+window.scrollY+px(bs.paddingBottom)+px(bs.borderBottomWidth)+px(bs.marginBottom));}
var last=0;var lastComplete=false;var queued=false;
function post(){queued=false;var h=measure();var complete=document.readyState==='complete';
if(h>0&&(h!==last||complete!==lastComplete)){last=h;lastComplete=complete;
parent.postMessage({source:SOURCE,type:'resize',height:h,complete:complete},'*');}}
function schedule(){if(!queued){queued=true;requestAnimationFrame(post);}}
window.addEventListener('message',function(e){
if(e.source!==parent)return;var d=e.data;
if(!d||d.source!==SOURCE||d.type!=='viewport'||typeof d.height!=='number')return;
setVh(d.height);last=0;schedule();});
document.addEventListener('DOMContentLoaded',function(){schedule();
if(window.ResizeObserver){var ro=new ResizeObserver(schedule);ro.observe(root);ro.observe(document.body);}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});});
document.addEventListener('load',schedule,true);
if(document.fonts&&document.fonts.ready){document.fonts.ready.then(schedule);}
window.addEventListener('load',schedule);
})();</script>`;
}

/**
 * The `srcdoc` for an `html` object: the author's page (with `vh` rewritten) and the bootstrap
 * injected at the top of `<head>`. A fragment without `<html>` / `<head>` is wrapped in a minimal
 * document.
 */
export function buildHtmlSandboxDocument(
  source: string,
  options: { viewportHeight: number },
): string {
  const page = rewriteViewportHeightUnits(source);
  const bootstrap = bootstrapScript(options.viewportHeight);

  const head = page.match(HEAD_OPEN_TAG_REGEX);
  if (head?.index !== undefined) {
    const at = head.index + head[0].length;
    return `${page.slice(0, at)}${bootstrap}${page.slice(at)}`;
  }

  const html = page.match(HTML_OPEN_TAG_REGEX);
  if (html?.index !== undefined) {
    const at = html.index + html[0].length;
    return `${page.slice(0, at)}<head>${bootstrap}</head>${page.slice(at)}`;
  }

  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    bootstrap,
    '</head><body>',
    page,
    '</body></html>',
  ].join('');
}

/** Message the parent sends into the frame: 1% of it sets `--odl-vh`, and the frame re-posts its height. */
export function buildHtmlSandboxViewportMessage(viewportHeight: number) {
  return { source: HTML_SANDBOX_MESSAGE_SOURCE, type: 'viewport', height: viewportHeight } as const;
}

export type HtmlSandboxResizeMessage = {
  height: number;
  /** The page has finished loading (images, fonts): its height is final enough to show. */
  complete: boolean;
};

/** Parses a resize message from the bootstrap; anything else is ignored. */
export function parseHtmlSandboxResizeMessage(data: unknown): HtmlSandboxResizeMessage | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (record.source !== HTML_SANDBOX_MESSAGE_SOURCE || record.type !== 'resize') {
    return null;
  }
  const height = record.height;
  if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
    return null;
  }
  return { height, complete: record.complete === true };
}
