import { formatMessage, messagePlaceholderPattern, splitMessage } from './format-message';

describe('splitMessage', () => {
  it('splits around the first placeholder', () => {
    expect(splitMessage('Ignored {following} today', 'following')).toEqual(['Ignored ', ' today']);
  });

  it('keeps word order of the language', () => {
    expect(splitMessage('{following} ignoriert', 'following')).toEqual(['', ' ignoriert']);
  });

  it('returns null without the placeholder', () => {
    expect(splitMessage('No placeholder', 'following')).toBeNull();
  });
});

describe('formatMessage', () => {
  it('returns the template unchanged without values', () => {
    expect(formatMessage('Hello {name}')).toBe('Hello {name}');
  });

  it('fills every occurrence of a placeholder', () => {
    expect(formatMessage('{a} and {a} and {b}', { a: 'x', b: 2 })).toBe('x and x and 2');
  });

  it('keeps placeholders that have no value', () => {
    expect(formatMessage('{known} {unknown}', { known: 'k' })).toBe('k {unknown}');
  });

  it('inserts values literally, including replacement patterns', () => {
    expect(formatMessage('Paid {amount}', { amount: "$& $1 $'" })).toBe("Paid $& $1 $'");
  });

  it('does not treat ${name} or @name as placeholders', () => {
    expect(formatMessage('@account owes ${amount}', { account: 'a', amount: '1' })).toBe(
      '@account owes $1',
    );
  });
});

describe('messagePlaceholderPattern', () => {
  it('returns an independent matcher each call', () => {
    const first = messagePlaceholderPattern();
    first.exec('{a} {b}');
    expect(messagePlaceholderPattern().lastIndex).toBe(0);
  });
});
