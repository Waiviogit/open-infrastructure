---
id: web-components-linkedin-embed
title: LinkedIn embed height
description: "LinkedIn post iframes post no height to the parent page; the web app sizes them from the card layout of the embed page (`/api/social-embed/linkedin`) and the commentary wrapped at the iframe width."
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

# LinkedIn embed height

**Back:** [web overview](../overview.md) · **Related:** [Story container](story-container.md), [post article](../pages/user-profile/routes/post-article.md), [BFF API](../bff-api.md)

## Problem

Instagram, Facebook and X iframes report their height with `postMessage`, and `useBindSocialEmbedHeights` grows the wrapper to it. LinkedIn's `/embed/feed/update/urn:li:…` page sends no such message, so the card kept the CSS fallback height (`960px`). A short text post then showed several hundred pixels of empty card, and LinkedIn's Share overlay (`position: fixed`) filled that whole box.

## Behavior

- Every container that uses `useBindSocialEmbedHeights` (`SocialEmbedHtml` post bodies and Activity messages, `VideoPreviewPlayer` feed widgets) also runs `useFitLinkedInEmbeds`.
- For each LinkedIn iframe (including ones mounted later), the client fetches `GET /api/social-embed/linkedin?urn=…` once per URN per page. The route reads the public embed page and returns the card layout:
  - `commentary`: the post text as plain text,
  - `hasActivityHeader`: the "… reposted this" line,
  - `media`: `none`, `image`, `image-grid` or `article`.
- Height = card chrome (181px) + activity header (40px) + commentary height + media block (4px gap + 400 single image / 360 grid / 470 article) + 8px safety. The commentary is measured in a hidden element with LinkedIn's font (`14px/21px` system stack, `pre-wrap`) at the iframe width minus 34px (border + padding).
- The height is computed again when the iframe width changes (`ResizeObserver`).
- A single image's aspect ratio is not in the embed HTML, so the estimate uses LinkedIn's 400px cap. A landscape image leaves up to ~180px of empty space at the bottom of the card. Text-only posts, image grids and articles fit to within 30px.

## Fallback

The CSS height (`960px` on `.blog-post-linkedin-embed` / `.video-embed-widget--linkedin`) stays when:

- the card has a block the estimate does not know (video, document, poll, reshared post). The route answers **422** for any `data-test-id` outside its known list.
- LinkedIn is unreachable or answers non-200 (**502** / **404**).

## Code

| Piece | Path |
|-------|------|
| Layout parser, height estimate, client fetch | `apps/web/src/shared/infrastructure/linkedin-embed-layout.ts` |
| BFF route (1h `Cache-Control`) | `apps/web/src/app/api/social-embed/linkedin/route.ts` |
| Hook (measure + apply) | `apps/web/src/shared/presentation/hooks/use-fit-linkedin-embeds.ts` |

The block sizes were measured on the live embed at 340, 420 and 540px widths. If LinkedIn changes its embed markup, unknown blocks fall back to the CSS height, but a changed size for a known block is not detected. Re-measure in that case.

## Verification

- `pnpm nx test web --testPathPatterns="(linkedin-embed-layout|social-embed/linkedin|use-fit-linkedin-embeds)"`
