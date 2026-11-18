import { INSTACART_RECIPE_POST_MAX_CHARS } from './instacart.constants';
import { buildInstacartRecipePrompt, recipeMethodFromPostBody } from './instacart-recipe-prompt';

describe('recipeMethodFromPostBody', () => {
  it('drops markdown and HTML images and collapses blank lines', () => {
    const body = 'Intro\n\n![pie](https://a/b.jpg)\n\n\n\n<img src="https://c/d.png">\n1. Mix';
    expect(recipeMethodFromPostBody(body)).toBe('Intro\n\n1. Mix');
  });

  it('caps the method length', () => {
    const body = 'x'.repeat(INSTACART_RECIPE_POST_MAX_CHARS + 100);
    expect(recipeMethodFromPostBody(body)).toHaveLength(INSTACART_RECIPE_POST_MAX_CHARS);
  });
});

describe('buildInstacartRecipePrompt', () => {
  const base = {
    name: 'Apple pie',
    description: 'A pie',
    ingredients: ['Dough: 350 g flour', 'Filling: 30 g flour'],
    servings: '8',
  };

  it('includes the ingredient list, servings field and post', () => {
    const prompt = buildInstacartRecipePrompt({ ...base, method: '1. Bake at 200°C' });
    expect(prompt).toContain(JSON.stringify(base.ingredients));
    expect(prompt).toContain('Servings field: 8');
    expect(prompt).toContain('1. Bake at 200°C');
  });

  it('marks a missing post and servings field', () => {
    const prompt = buildInstacartRecipePrompt({ ...base, servings: undefined, method: null });
    expect(prompt).toContain('Recipe post: none');
    expect(prompt).toContain('Servings field: not set');
  });
});
