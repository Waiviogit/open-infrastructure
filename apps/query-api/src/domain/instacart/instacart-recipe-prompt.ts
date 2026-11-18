import type { OpenAiJsonSchema } from '../openai';
import { INSTACART_RECIPE_POST_MAX_CHARS } from './instacart.constants';

/**
 * Bump when the prompt or schema changes so cached Instacart links are rebuilt.
 * Part of the Redis cache fingerprint.
 */
export const INSTACART_RECIPE_PROMPT_VERSION = 2;

const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/g;
const HTML_IMAGE_RE = /<img\b[^>]*>/gi;
const EXTRA_BLANK_LINES_RE = /\n{3,}/g;

export const INSTACART_RECIPE_JSON_SCHEMA: OpenAiJsonSchema = {
  name: 'instacart_recipe',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ingredients: {
        type: 'array',
        description: 'Shopping list: one entry per distinct product.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              description:
                'Generic product name used as an Instacart search term, e.g. "all-purpose flour".',
            },
            measurements: {
              type: 'array',
              description:
                'The SAME total amount expressed in one or more units (e.g. 1 cup and 240 milliliter). Never different amounts.',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  quantity: { type: 'number', description: 'Amount greater than 0.' },
                  unit: {
                    type: 'string',
                    description:
                      'Unit: each, gram, kilogram, ounce, pound, milliliter, liter, cup, tablespoon, teaspoon, pinch, clove, can, package, bunch.',
                  },
                },
                required: ['quantity', 'unit'],
              },
            },
          },
          required: ['name', 'measurements'],
        },
      },
      instructions: {
        type: 'array',
        description: 'Preparation steps in order, one string per step, without numbering.',
        items: { type: 'string' },
      },
      servings: {
        type: 'integer',
        description: 'Servings the recipe yields when stated; minimum 1.',
      },
    },
    required: ['ingredients', 'instructions', 'servings'],
  },
};

/** Post markdown as method source: images removed, length capped for the prompt. */
export function recipeMethodFromPostBody(body: string): string {
  return body
    .replace(MARKDOWN_IMAGE_RE, '')
    .replace(HTML_IMAGE_RE, '')
    .replace(EXTRA_BLANK_LINES_RE, '\n\n')
    .trim()
    .slice(0, INSTACART_RECIPE_POST_MAX_CHARS);
}

export function buildInstacartRecipePrompt(input: {
  name: string;
  description: string;
  ingredients: string[];
  servings: unknown;
  /** Featured post markdown; null when the recipe has no posts. */
  method: string | null;
}): string {
  const servings =
    typeof input.servings === 'string' || typeof input.servings === 'number'
      ? String(input.servings)
      : 'not set';
  const method = input.method
    ? `Recipe post (markdown):\n"""\n${input.method}\n"""`
    : 'Recipe post: none';

  return `You prepare an Instacart recipe page from a published recipe. Return JSON matching the schema.

INGREDIENTS (shopping list) - build it from the ingredient list below only:
- One entry per distinct product. When the same product appears several times (for example in dough and in filling), output it once with the summed total. Convert to one unit before adding (use weight or volume as written; e.g. 2 tbsp sugar + 100 g sugar = about 125 g).
- "measurements" is the same total in alternative units, each one equal to the whole total (e.g. 225 g and about 1.1 cup). Usually one measurement is enough. Never list separate or partial amounts of one product there.
- "A or B" alternatives for the same item: use only the first option, with the stated amount (do not buy both).
- If an amount is a range, use the larger value. Items without an amount ("to taste", "a pinch") get a sensible small amount (1 pinch, 1 each).
- "name" is a generic product to search for: drop emojis, section labels ("Dough:", "Filling:"), and preparation notes ("diced", "peeled", "room temperature").
- Do not add products that are not in the ingredient list (serving suggestions, garnish ideas, equipment).

INSTRUCTIONS - rewrite the recipe method as clear steps:
- Source of truth: the "Recipe post" below when present, otherwise the description.
- Keep every concrete detail exactly as written: temperatures (all units given), times, rest and chill durations, pan sizes, quantities, doneness cues.
- Never add a fact that is not in the source: no temperature, time, pan size or tool that the source does not mention.
- If the source has numbered steps, keep the same steps in the same order; only drop numbering and fix wording. Do not merge or drop steps. Keep ingredient alternatives in steps as the source writes them.
- Steps are cooking actions only. Leave out prep/cook time summaries, equipment lists, tips, variations, notes, serving suggestions that are not part of the method, and source/credit lines.
- If the source has no method, write short steps that follow only what the description says.
- Write in the same language as the source.

SERVINGS: the yield stated in the servings field or the source; otherwise estimate from the quantities.

Recipe name: ${input.name}
Servings field: ${servings}
Ingredient list: ${JSON.stringify(input.ingredients)}
Description: ${input.description}
${method}
`;
}
