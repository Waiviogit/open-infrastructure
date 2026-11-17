import {
  LINK_TYPES,
  OBJECT_TYPE_REGISTRY,
  UPDATE_TYPES,
  expandPostLanguageTags,
  parsePostRef,
  type LinkType,
} from '@opden-data-layer/core';
import type { ResolvedObjectView } from '@opden-data-layer/objects-domain';
import type {
  ObjectNewsFeedFilter,
  ObjectPostFeedScope,
  PostAuthorPermlinkRef,
} from '../../repositories/object-post-feed-scope.types';
import { selectObjectFeedPins, type ViewerUpdateVotes } from './object-feed-pins';

const LINK_OBJECT_TYPE = 'link';
const HASHTAG_OBJECT_TYPE = 'hashtag';
const NEWSFEED_OBJECT_TYPE = 'newsfeed';

/** Legacy `socialLinksMap` — base URL per canonical link channel `type`. */
export const SOCIAL_LINK_BASE: Partial<Record<LinkType, string>> = {
  facebook: 'https://www.facebook.com/profile.php?id=',
  twitter: 'https://x.com/',
  youtube: 'https://www.youtube.com/@',
  instagram: 'https://www.instagram.com/',
  github: 'https://github.com/',
  tiktok: 'https://www.tiktok.com/@',
  snapchat: 'https://www.snapchat.com/add/',
};

const HIVE_WALLET_SYMBOLS = new Set(['HIVE', 'HBD']);

export function objectTypesSupportingWalletAddress(): string[] {
  return Object.entries(OBJECT_TYPE_REGISTRY)
    .filter(([, def]) => def.supported_updates.includes(UPDATE_TYPES.WALLET_ADDRESS))
    .map(([key]) => key);
}

function collectJsonValues<T>(view: ResolvedObjectView, updateType: string): T[] {
  const field = view.fields[updateType];
  if (!field) {
    return [];
  }
  const out: T[] = [];
  for (const u of field.values) {
    if (u.validity_status !== 'VALID') {
      continue;
    }
    if (u.value_json != null && typeof u.value_json === 'object') {
      out.push(u.value_json as T);
    }
  }
  return out;
}

function firstSingleTextValue(view: ResolvedObjectView, updateType: string): string | null {
  const field = view.fields[updateType];
  const winner = field?.values.find((u) => u.validity_status === 'VALID');
  const text = winner?.value_text?.trim();
  return text || null;
}

function firstSingleJsonValue<T extends Record<string, unknown>>(
  view: ResolvedObjectView,
  updateType: string,
): T | null {
  const field = view.fields[updateType];
  const winner = field?.values.find((u) => u.validity_status === 'VALID');
  if (winner?.value_json != null && typeof winner.value_json === 'object') {
    return winner.value_json as T;
  }
  return null;
}

function makeLinkPrefix(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.endsWith('*') ? trimmed.slice(0, -1) : trimmed;
}

function parseNewsFeedFilter(view: ResolvedObjectView): ObjectNewsFeedFilter | null {
  const raw = firstSingleJsonValue<{
    allow_list?: string[][];
    ignore_list?: string[];
    type_list?: string[];
    authors?: string[];
  }>(view, UPDATE_TYPES.NEWS_FEED);

  if (!raw) {
    return null;
  }

  const allowList = (raw.allow_list ?? []).map((rule) =>
    Array.isArray(rule) ? rule.map((id) => String(id).trim()).filter(Boolean) : [],
  );
  const ignoreList = (raw.ignore_list ?? []).map((id) => String(id).trim()).filter(Boolean);
  const typeList = (raw.type_list ?? []).map((t) => String(t).trim()).filter(Boolean);
  const authors = (raw.authors ?? []).map((a) => String(a).trim()).filter(Boolean);

  const hasAny =
    allowList.some((r) => r.length > 0) ||
    ignoreList.length > 0 ||
    typeList.length > 0 ||
    authors.length > 0 ||
    allowList.some((r) => r.length === 0);

  if (!hasAny) {
    return null;
  }

  return { allowList, ignoreList, typeList, authors };
}

function buildSocialLinkPrefixes(view: ResolvedObjectView): string[] {
  const links = collectJsonValues<{ type?: string; value?: string }>(view, UPDATE_TYPES.LINK);
  const prefixes: string[] = [];

  for (const link of links) {
    const type = link.type?.trim() as LinkType | undefined;
    const value = link.value?.trim();
    if (!type || !value) {
      continue;
    }
    const base = SOCIAL_LINK_BASE[type];
    if (base) {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        prefixes.push(value);
      } else {
        prefixes.push(`${base}${value}`);
        if (type === 'facebook') {
          prefixes.push(`https://www.facebook.com/${value}`);
        }
      }
      continue;
    }
    if ((LINK_TYPES as readonly string[]).includes(type)) {
      prefixes.push(value);
    }
  }

  return prefixes;
}

function buildWebsiteLinkPrefixes(view: ResolvedObjectView): string[] {
  const websites = collectJsonValues<{ link?: string }>(view, UPDATE_TYPES.WEBSITE);
  const prefixes: string[] = [];
  for (const site of websites) {
    const prefix = site.link ? makeLinkPrefix(site.link) : null;
    if (prefix) {
      prefixes.push(prefix);
    }
  }
  return prefixes;
}

function buildHiveMentionAccounts(view: ResolvedObjectView): string[] {
  const wallets = collectJsonValues<{ symbol?: string; address?: string }>(
    view,
    UPDATE_TYPES.WALLET_ADDRESS,
  );
  const accounts: string[] = [];
  for (const wallet of wallets) {
    const symbol = wallet.symbol?.trim();
    const address = wallet.address?.trim();
    if (!symbol || !address) {
      continue;
    }
    if (HIVE_WALLET_SYMBOLS.has(symbol)) {
      accounts.push(address);
    }
  }
  return [...new Set(accounts)];
}

function buildLinkUrlPrefixes(view: ResolvedObjectView): string[] {
  const prefixes: string[] = [];

  if (view.object_type === LINK_OBJECT_TYPE) {
    const url = firstSingleTextValue(view, UPDATE_TYPES.URL);
    const prefix = url ? makeLinkPrefix(url) : null;
    if (prefix) {
      prefixes.push(prefix);
    }
    return prefixes;
  }

  if (objectTypesSupportingWalletAddress().includes(view.object_type)) {
    prefixes.push(...buildSocialLinkPrefixes(view));
    prefixes.push(...buildWebsiteLinkPrefixes(view));
  }

  return [...new Set(prefixes)];
}

function dedupePostRefs(refs: PostAuthorPermlinkRef[]): PostAuthorPermlinkRef[] {
  const seen = new Set<string>();
  const out: PostAuthorPermlinkRef[] = [];
  for (const ref of refs) {
    const key = `${ref.author}\0${ref.permlink}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(ref);
  }
  return out;
}

export function buildObjectPostFeedScope(params: {
  view: ResolvedObjectView;
  linkedObjectIds: string[];
  mutedAuthors: string[];
  locale: string;
  viewerAccount?: string;
  viewerVotes: ViewerUpdateVotes;
  maxPinned: number;
}): ObjectPostFeedScope {
  const { view, linkedObjectIds, mutedAuthors, locale, viewerAccount, viewerVotes, maxPinned } =
    params;
  const newsFilter = parseNewsFeedFilter(view);
  const newsFeedMode = view.object_type === NEWSFEED_OBJECT_TYPE;

  const pins = selectObjectFeedPins({ view, viewerAccount, viewerVotes, maxPinned });
  const excludedPostRefs = dedupePostRefs(
    parsePinnedPostRefs([...pins.removeRefs, ...pins.pinnedRefs]),
  );

  const languages: string[] = [];
  if (view.object_type === HASHTAG_OBJECT_TYPE && locale.trim() !== '') {
    languages.push(...expandPostLanguageTags([locale.trim()]));
  }

  const mentionAccounts =
    view.object_type === LINK_OBJECT_TYPE
      ? []
      : objectTypesSupportingWalletAddress().includes(view.object_type)
        ? buildHiveMentionAccounts(view)
        : [];

  return {
    objectId: view.object_id,
    objectType: view.object_type,
    newsFeedMode,
    newsFilter: newsFeedMode ? newsFilter : null,
    linkedObjectIds: [...new Set(linkedObjectIds.map((id) => id.trim()).filter(Boolean))],
    linkUrlPrefixes: buildLinkUrlPrefixes(view),
    mentionAccounts,
    languages,
    excludedPostRefs,
    pinnedPostRefs: pins.pinnedRefs,
    viewerPinnedPostRefs: pins.viewerPinnedRefs,
    removePostRefs: pins.removeRefs,
    mutedAuthors: [...new Set(mutedAuthors.map((a) => a.trim()).filter(Boolean))],
    newsFeedAuthorsOnly: Boolean(newsFeedMode && newsFilter && newsFilter.authors.length > 0),
  };
}

export function pinnedRefsToKeys(refs: PostAuthorPermlinkRef[]): { author: string; permlink: string }[] {
  return refs.map((r) => ({ author: r.author, permlink: r.permlink }));
}

export function parsePinnedPostRefs(refs: readonly string[]): PostAuthorPermlinkRef[] {
  return refs.map(parsePostRef).filter((r): r is PostAuthorPermlinkRef => r != null);
}
