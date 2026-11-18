export const INSTACART_PRODUCT_ID_TYPE = 'instacart';

export const INSTACART_STOREFRONT_URL = 'https://www.instacart.com';

export const INSTACART_UTM_CAMPAIGN = 'instacart-idp';
export const INSTACART_UTM_MEDIUM = 'affiliate';
export const INSTACART_UTM_SOURCE = 'instacart_idp';
export const INSTACART_UTM_TERM = 'partnertype-mediapartner';
export const INSTACART_UTM_CONTENT_PREFIX = 'campaignid-20313_partnerid-';

/** Featured post markdown sent to OpenAI as the method source is capped at this length. */
export const INSTACART_RECIPE_POST_MAX_CHARS = 12_000;

/** Recipe formatting takes 4–10 s on the default model; the shared 12 s external timeout is too tight. */
export const INSTACART_LLM_TIMEOUT_MS = 30_000;

/** Low effort keeps the same output quality as the default at about half the latency. */
export const INSTACART_LLM_REASONING_EFFORT = 'low';

/** Hex chars of the SHA-256 input fingerprint kept in the Redis cache key. */
export const INSTACART_RECIPE_FINGERPRINT_LENGTH = 16;
