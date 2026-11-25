import { buildPrefixTsQuery } from './build-prefix-ts-query';
import { normalizeSearchText } from './normalize-search-text';
import { SEARCH_QUERY_MAX_TOKENS } from './search-text.constants';

describe('normalizeSearchText', () => {
  it.each([
    ['Greek  Taverna!', 'greek taverna'],
    ['kvu-kis', 'kvu kis'],
    ["Women's", 'womens'],
    ['Women’s', 'womens'],
    ['Womenʼs', 'womens'],
    ['İstanbul', 'istanbul'],
    ['soft­hyphen', 'softhyphen'],
    ['zero​width', 'zerowidth'],
    ['1,000', '1 000'],
    ['john.doe@mail.com', 'john doe mail com'],
    ['https://example.com/a_b?x=1', 'https example com a b x 1'],
    ['Привет, Мир', 'привет мир'],
    ['Ｆｕｌｌｗｉｄｔｈ', 'fullwidth'],
    ['  ', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });

  it('keeps decomposed accents composed and does not fold them', () => {
    expect(normalizeSearchText('café')).toBe('café');
    expect(normalizeSearchText('café')).not.toBe('cafe');
  });

  it('keeps combining marks inside Hindi and Thai words', () => {
    expect(normalizeSearchText('हिन्दी नमस्ते')).toBe('हिन्दी नमस्ते');
    expect(normalizeSearchText('สวัสดีครับ')).toBe('สวัสดีครับ');
  });

  it('removes an apostrophe only between letters or digits', () => {
    expect(normalizeSearchText("'quoted'")).toBe('quoted');
    expect(normalizeSearchText("rock 'n' roll")).toBe('rock n roll');
  });
});

describe('buildPrefixTsQuery', () => {
  it.each([
    ['greek tav', 'greek:* & tav:*'],
    ['kvu-kis', 'kvu:* & kis:*'],
    ['iphone 5 pro', 'iphone:* & 5 & pro:*'],
    ['vitamin c', 'vitamin:*'],
    ["women's", 'womens:*'],
    ['Привет мир', 'привет:* & мир:*'],
    ['東', '東:*'],
    ['東京 タ', '東京:* & タ:*'],
  ])('%j → %j', (input, expected) => {
    expect(buildPrefixTsQuery(input)).toBe(expected);
  });

  it.each(['', '   ', 'c', 'c++', '!!', 'a b'])('%j → null', (input) => {
    expect(buildPrefixTsQuery(input)).toBeNull();
  });

  it(`keeps at most ${SEARCH_QUERY_MAX_TOKENS} tokens`, () => {
    const words = Array.from(
      { length: SEARCH_QUERY_MAX_TOKENS + 5 },
      (_, i) => `word${i}`,
    );
    const query = buildPrefixTsQuery(words.join(' '));
    expect(query?.split(' & ')).toHaveLength(SEARCH_QUERY_MAX_TOKENS);
  });

  it('never emits LIKE wildcards, escapes or tsquery operators', () => {
    const inputs = [
      '100% _cool_ \\path\\',
      "o'reilly & (x | !y)",
      'a:* b <-> c',
      "it''s",
    ];
    for (const input of inputs) {
      const query = buildPrefixTsQuery(input) ?? '';
      const operands = query
        .split(' & ')
        .map((term) => term.replace(/:\*$/, ''));
      for (const operand of operands) {
        expect(operand).not.toMatch(/[%_\\&|!():*'<>-]/);
      }
    }
  });
});
