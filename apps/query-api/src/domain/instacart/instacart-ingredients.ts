export type InstacartIngredient = {
  name: string;
  measurements?: { quantity: number; unit: string }[];
};

export type InstacartRecipePayload = {
  title: string;
  link_type: 'recipe';
  ingredients: InstacartIngredient[];
  instructions: string[];
  servings: number;
  image_url?: string;
};

export const DEFAULT_INSTACART_SERVINGS = 1;

export function parseServingsCount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    return n >= 1 ? n : null;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const match = raw.trim().match(/(\d+(?:\.\d+)?)/);
  if (!match?.[1]) {
    return null;
  }
  const n = Math.floor(Number(match[1]));
  return n >= 1 ? n : null;
}

export function resolveInstacartServings(
  fieldValue: unknown,
  llmServings: number | null,
): number {
  return parseServingsCount(fieldValue) ?? llmServings ?? DEFAULT_INSTACART_SERVINGS;
}

export function readIngredientNames(fields: Record<string, unknown>): string[] {
  const raw = fields.ingredients;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push(item.trim());
    }
  }
  return out;
}

export function readRecipeImageUrl(fields: Record<string, unknown>): string | undefined {
  for (const key of ['image', 'imageBackground'] as const) {
    const raw = fields[key];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const url = (raw as { url?: unknown }).url;
      if (typeof url === 'string' && url.trim()) {
        return url.trim();
      }
    }
  }
  return undefined;
}

/** Fallback without OpenAI: names as search terms, the description as a single step. */
export function rawInstacartIngredients(
  names: string[],
  description: string,
): { ingredients: InstacartIngredient[]; instructions: string[] } {
  return {
    ingredients: names.map((name) => ({ name })),
    instructions: description ? [description] : [],
  };
}

export function parseLlmRecipeIngredients(
  raw: unknown,
): {
  ingredients: InstacartIngredient[];
  instructions: string[];
  servings: number | null;
} | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  if (!Array.isArray(rec.ingredients) || !Array.isArray(rec.instructions)) {
    return null;
  }
  const ingredients: InstacartIngredient[] = [];
  for (const item of rec.ingredients) {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const name = (item as { name?: unknown }).name;
    if (typeof name !== 'string' || !name.trim()) {
      continue;
    }
    ingredients.push(item as InstacartIngredient);
  }
  const instructions = rec.instructions.filter(
    (step): step is string => typeof step === 'string' && step.trim().length > 0,
  );
  if (ingredients.length === 0 || instructions.length === 0) {
    return null;
  }
  return {
    ingredients,
    instructions,
    servings: parseServingsCount(rec.servings),
  };
}

export function buildInstacartRecipePayload(input: {
  title: string;
  ingredients: InstacartIngredient[];
  instructions: string[];
  servings: number;
  imageUrl?: string;
}): InstacartRecipePayload {
  return {
    title: input.title,
    link_type: 'recipe',
    ingredients: input.ingredients,
    instructions: input.instructions,
    servings: input.servings,
    ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
  };
}
