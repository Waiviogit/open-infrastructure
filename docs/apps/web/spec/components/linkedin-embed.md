---
id: web-components-linkedin-embed
title: LinkedIn post card
description: "LinkedIn post iframes post no height to the parent page, so the web app renders LinkedIn posts as its own card from the public embed page (`/api/social-embed/linkedin`); unknown layouts keep the iframe."
type: spec
status: active
scope: web
tags: [web, components, embeds]
updated_at: 2026-11-17
related:
  - docs/apps/web/spec/components/story-container.md
  - docs/apps/web/spec/pages/user-profile/routes/post-article.md
  - docs/apps/web/spec/bff-api.md
---

# LinkedIn post card

**Back:** [web overview](../overview.md) · **Related:** [Story container](story-container.md), [post article](../pages/user-profile/routes/post-article.md), [BFF API](../bff-api.md)

## Problem

Instagram, Facebook and X iframes report their height with `postMessage`, and `useBindSocialEmbedHeights` grows the wrapper to it. LinkedIn's `/embed/feed/update/urn:li:…` page sends no such message, and no public LinkedIn API or embed library sizes it: hosts set a fixed height or tune it by hand.

The previous fix estimated the height from the card layout. It could not be exact:

- A single image's aspect ratio is not in the embed HTML, so the estimate reserved LinkedIn's 400px cap and landscape photos left empty space under the image.
- The Like / Comment / Share bar is `flex-wrap`. Its labels follow the viewer's LinkedIn language, so in Russian ("Комментировать", "Поделиться") the bar wraps to a second row and the Share button was cut off.

## Behavior

The web app does not show the LinkedIn iframe. It renders the post as its own card, which grows with its content and follows the theme.

- `SocialEmbedHtml` (post bodies, comments, Activity messages and notes) swaps every LinkedIn embed iframe in the sanitized HTML for an empty slot `<div class="linkedin-post-slot" data-linkedin-urn="urn:li:…">` (`linkedInIframesToCardSlots`). The iframe never loads. `useLinkedInPostSlots` portals `LinkedInPostEmbed` into each slot. Before hydration the empty slot shows a placeholder box (`global.css`).
- `VideoPreviewPlayer` feed widgets render `LinkedInPostEmbed` directly for LinkedIn previews.
- `LinkedInPostEmbed` fetches `GET /api/social-embed/linkedin?urn=…` once per URN per page. The route reads the public embed page and returns the card:
  - `author`: name, headline, profile link, avatar,
  - `activityHeader`: the "… reposted this" line, as LinkedIn wrote it,
  - `commentary`: the post text as plain text, line breaks kept,
  - `media`: `none`, `images` (all images; one at natural height, several as a 2×2 grid with "+N"), `article` (cover, title, source) or `video` (progressive MP4 sources, poster, aspect ratio; played in a native `<video>`),
  - `reactionCount`, `commentCount`, and the post `permalink`.
- The card footer shows the counts and an **Open on LinkedIn** link (`linkedin_post_open`). Author, images and article open LinkedIn in a new tab.
- Links are kept only for `linkedin.com` hosts and media only for `licdn.com` hosts, over https; LinkedIn's `trk` tracking parameter is dropped. The client validates the BFF payload with the same zod schema.
- LinkedIn CDN images skip the Hive image proxy (`media.licdn.com` in `SKIP_PROXY_SUBSTRINGS`): `images.hive.blog` answers 403 for them.

## Fallback

`LinkedInPostEmbed` renders the official iframe at the CSS height (`960px` on `.blog-post-linkedin-embed`) when:

- the post has a block the card does not know: reshared post, document, poll, … The route answers **422** for any `data-test-id` outside its known list, and for a video without MP4 sources.
- LinkedIn is unreachable or answers non-200 (**502** / **404**).

## Code

| Piece | Path |
|-------|------|
| Card parser, payload schema, iframe → slot transform, client fetch | `apps/web/src/shared/infrastructure/linkedin-post-card.ts` |
| BFF route (1h `Cache-Control`) | `apps/web/src/app/api/social-embed/linkedin/route.ts` |
| Card view | `apps/web/src/shared/presentation/components/linkedin-post-card.tsx` |
| Fetch, loading placeholder, iframe fallback | `apps/web/src/shared/presentation/components/linkedin-post-embed.tsx` |
| Slot portals for sanitized HTML | `apps/web/src/shared/presentation/hooks/use-linkedin-post-slots.tsx` |

The parser was checked against live embed pages of profile and company posts: text, image, article, landscape and portrait video, and repost. If LinkedIn changes its embed markup, unknown blocks fall back to the iframe; a changed attribute inside a known block shows up as missing data in the card.

## Verification

- `pnpm nx test web --testPathPatterns="(linkedin-post|social-embed/linkedin)"`
