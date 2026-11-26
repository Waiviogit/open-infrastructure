import { createImageFallbackMemory } from './image-fallback-memory';

describe('createImageFallbackMemory', () => {
  it('returns the last remembered phase of a url', () => {
    const memory = createImageFallbackMemory<'raw' | 'proxy' | 'placeholder'>();
    expect(memory.get('https://a/1.png')).toBeUndefined();

    memory.remember('https://a/1.png', 'proxy');
    memory.remember('https://a/1.png', 'placeholder');

    expect(memory.get('https://a/1.png')).toBe('placeholder');
  });

  it('drops the oldest url beyond 200 entries', () => {
    const memory = createImageFallbackMemory<'proxy'>();
    for (let i = 0; i <= 200; i += 1) {
      memory.remember(`https://a/${i}.png`, 'proxy');
    }

    expect(memory.get('https://a/0.png')).toBeUndefined();
    expect(memory.get('https://a/1.png')).toBe('proxy');
    expect(memory.get('https://a/200.png')).toBe('proxy');
  });
});
