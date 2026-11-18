import { createHash } from 'node:crypto';
import { INSTACART_RECIPE_LINK_CACHE_TTL_SEC } from '../../constants/cache.constants';
import type { OpenAiJsonClient } from '../openai';
import {
  INSTACART_LLM_REASONING_EFFORT,
  INSTACART_LLM_TIMEOUT_MS,
  INSTACART_RECIPE_FINGERPRINT_LENGTH,
} from './instacart.constants';
import {
  buildInstacartRecipePayload,
  parseLlmRecipeIngredients,
  rawInstacartIngredients,
  readIngredientNames,
  readRecipeImageUrl,
  resolveInstacartServings,
  type InstacartRecipePayload,
} from './instacart-ingredients';
import {
  buildInstacartRecipePrompt,
  INSTACART_RECIPE_JSON_SCHEMA,
  INSTACART_RECIPE_PROMPT_VERSION,
  recipeMethodFromPostBody,
} from './instacart-recipe-prompt';
import { finalizeInstacartUrl, instacartStorefrontUrl, stripQueryParams } from './instacart-url';

export type InstacartRecipeObject = {
  object_id: string;
  object_type: string;
  fields: Record<string, unknown>;
};

export type InstacartRecipeLinkDeps = {
  instacartKey: string | undefined;
  openaiKey: string | undefined;
  countryCode: string | null;
  affiliateCode: string | null;
  fallbackOrigin: string;
  /** Body of the recipe's featured post (top pin, else newest post); null when it has none. */
  loadFeaturedPostBody: () => Promise<string | null>;
  cacheGet: (objectId: string, fingerprint: string) => Promise<string | null>;
  cacheSet: (objectId: string, fingerprint: string, url: string, ttlSec: number) => Promise<void>;
  openai: Pick<OpenAiJsonClient, 'promptWithJsonSchema'>;
  createRecipe: (payload: InstacartRecipePayload) => Promise<{ url: string } | { error: string }>;
};

export class InstacartLinkRejectedError extends Error {
  constructor(
    readonly status: 422,
    message: string,
  ) {
    super(message);
    this.name = 'InstacartLinkRejectedError';
  }
}

type RecipeGenerationInput = {
  title: string;
  description: string;
  ingredients: string[];
  servings: unknown;
  imageUrl: string | undefined;
  method: string | null;
};

/** Changes whenever anything sent to OpenAI / IDP changes, including the prompt version. */
function recipeInputFingerprint(input: RecipeGenerationInput): string {
  return createHash('sha256')
    .update(JSON.stringify({ version: INSTACART_RECIPE_PROMPT_VERSION, ...input }))
    .digest('hex')
    .slice(0, INSTACART_RECIPE_FINGERPRINT_LENGTH);
}

export async function createInstacartRecipeLink(
  object: InstacartRecipeObject,
  deps: InstacartRecipeLinkDeps,
): Promise<{ url: string }> {
  const finalize = (baseUrl: string) =>
    finalizeInstacartUrl({
      baseUrl,
      countryCode: deps.countryCode,
      affiliateCode: deps.affiliateCode,
      fallbackOrigin: deps.fallbackOrigin,
    });
  const storefront = () => finalize(instacartStorefrontUrl(deps.countryCode));

  if (!deps.instacartKey) {
    return { url: storefront() };
  }

  const names = readIngredientNames(object.fields);
  if (names.length === 0) {
    throw new InstacartLinkRejectedError(422, 'Recipe has no usable ingredients');
  }

  const postBody = await deps.loadFeaturedPostBody();
  const input: RecipeGenerationInput = {
    title:
      (typeof object.fields.name === 'string' && object.fields.name.trim()) || object.object_id,
    description:
      typeof object.fields.description === 'string' ? object.fields.description.trim() : '',
    ingredients: names,
    servings: object.fields.servings,
    imageUrl: readRecipeImageUrl(object.fields),
    method: postBody?.trim() ? recipeMethodFromPostBody(postBody) : null,
  };
  const fingerprint = recipeInputFingerprint(input);

  const cached = await deps.cacheGet(object.object_id, fingerprint);
  if (cached) {
    return { url: finalize(cached) };
  }

  const raw = rawInstacartIngredients(names, input.description);
  let ingredients = raw.ingredients;
  let instructions = raw.instructions;
  let llmServings: number | null = null;

  if (deps.openaiKey) {
    const llm = await deps.openai.promptWithJsonSchema({
      prompt: buildInstacartRecipePrompt({
        name: input.title,
        description: input.description,
        ingredients: names,
        servings: input.servings,
        method: input.method,
      }),
      jsonSchema: INSTACART_RECIPE_JSON_SCHEMA,
      timeoutMs: INSTACART_LLM_TIMEOUT_MS,
      reasoningEffort: INSTACART_LLM_REASONING_EFFORT,
    });
    const parsed = parseLlmRecipeIngredients(llm.result);
    if (parsed) {
      ingredients = parsed.ingredients;
      instructions = parsed.instructions;
      llmServings = parsed.servings;
    }
  }

  const payload = buildInstacartRecipePayload({
    title: input.title,
    ingredients,
    instructions,
    servings: resolveInstacartServings(input.servings, llmServings),
    imageUrl: input.imageUrl,
  });
  const created = await deps.createRecipe(payload);
  if ('error' in created) {
    return { url: storefront() };
  }

  const bare = stripQueryParams(created.url);
  await deps.cacheSet(object.object_id, fingerprint, bare, INSTACART_RECIPE_LINK_CACHE_TTL_SEC);
  return { url: finalize(bare) };
}
