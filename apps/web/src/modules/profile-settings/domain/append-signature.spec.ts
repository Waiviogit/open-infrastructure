import { appendSignature } from './append-signature';

describe('appendSignature', () => {
  it('adds the signature as its own paragraph', () => {
    expect(appendSignature('Great post  \n', '— Neo')).toBe('Great post\n\n— Neo');
  });

  it('leaves the body unchanged without a signature or a body', () => {
    expect(appendSignature('Great post', null)).toBe('Great post');
    expect(appendSignature('Great post', '   ')).toBe('Great post');
    expect(appendSignature('  ', '— Neo')).toBe('  ');
  });

  it('does not sign twice', () => {
    expect(appendSignature('Great post\n\n— Neo', '— Neo')).toBe('Great post\n\n— Neo');
  });
});
