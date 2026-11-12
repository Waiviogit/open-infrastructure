/**
 * Post typography shared by the rendered post (`BlogPostScreen`) and the post editor, so the editor
 * looks like the published post. Class strings stay literal here so Tailwind generates them.
 */

/** Block rules for post prose (links, quotes, headings, paragraphs, lists) applied from the container. */
export const POST_BODY_BLOCK_CLASSES = [
  '[&_a]:break-words [&_a]:text-link',
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-fg-secondary',
  '[&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-section [&_h1]:font-weight-strong [&_h1]:font-display',
  '[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-body-lg [&_h2]:font-weight-strong [&_h2]:font-display',
  '[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:font-weight-strong',
  '[&_p]:mb-4',
  '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:mb-1',
].join(' ');

/**
 * The post's block rules at the body-sm scale of compact bodies (comments, activity messages, DMs,
 * activity notes), so markdown from any editor renders the same everywhere: preflight would
 * otherwise flatten lists, headings, quotes and rules into plain lines. Tables come from
 * `.blog-post-body` in `global.css`, so the container also needs that class.
 */
export const COMPACT_BODY_BLOCK_CLASSES = [
  '[&_a]:break-words [&_a]:text-link [&_a]:underline',
  '[&_blockquote]:my-2 [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:text-fg-secondary',
  '[&_h1]:mb-1.5 [&_h1]:mt-3 [&_h1]:text-body-lg [&_h1]:font-weight-strong [&_h1]:font-display',
  '[&_h2]:mb-1.5 [&_h2]:mt-3 [&_h2]:text-body [&_h2]:font-weight-strong [&_h2]:font-display',
  '[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:font-weight-strong',
  '[&_p]:mb-2 [&_p:last-child]:mb-0',
  '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:ps-5',
  '[&_li]:mb-0.5',
  '[&_hr]:my-3 [&_hr]:border-t [&_hr]:border-border',
  '[&_pre]:my-2',
  '[&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full',
  '[&>:first-child]:mt-0',
].join(' ');

/** Body text of the post modal (and the post preview). */
export const POST_BODY_EDITORIAL_CLASSES = 'text-body font-editorial leading-editorial';

/** Post title in the post modal (and the post preview). */
export const POST_MODAL_TITLE_CLASSES =
  'text-section font-weight-strong leading-compressed text-heading';
