import { ACTIVITY_NOTE_BODY_MAX_CHARS } from './activity-notes.constants';
import {
  fencedCodeBlock,
  parseActivityNoteImportHash,
  variantLabel,
} from './parse-activity-note-import-hash';

const CUSTOMER_HASH =
  '#top=**Speaking%20opportunity**%20%C2%B7%20first%20touch%20%C2%B7%20comment%0AEx-Twilio%20frontend%20dev%20building%20agents%20for%20coaches.%0AConfidence%3A%20moderate-high%20%C2%B7%20Risk%3A%20low&v=Allowing%20takes%20one%20click%2C%20finding%20it%20again%20takes%20an%20afternoon.%20One%20readable%20list%20of%20grants%20per%20agent%20would%20fix%20most%20of%20it.&v=The%20allow%20button%20takes%20a%20second...';

describe('parseActivityNoteImportHash', () => {
  it('builds the note from the customer example (top + two variants)', () => {
    expect(parseActivityNoteImportHash(CUSTOMER_HASH)).toBe(
      [
        '**Speaking opportunity** · first touch · comment',
        'Ex-Twilio frontend dev building agents for coaches.',
        'Confidence: moderate-high · Risk: low',
        '',
        '**A**',
        '```',
        'Allowing takes one click, finding it again takes an afternoon. One readable list of grants per agent would fix most of it.',
        '```',
        '',
        '**B**',
        '```',
        'The allow button takes a second...',
        '```',
      ].join('\n'),
    );
  });

  it('uses `note` verbatim (trimmed)', () => {
    const markdown = '# Draft\n\n**A**\n```\nHello *there*\n```';
    expect(parseActivityNoteImportHash(`#note=${encodeURIComponent(`  ${markdown}\n`)}`)).toBe(
      markdown,
    );
  });

  it('accepts a hash without the leading #', () => {
    expect(parseActivityNoteImportHash(`note=${encodeURIComponent('hi')}`)).toBe('hi');
  });

  it('lets `note` win over `top` / `v`', () => {
    expect(
      parseActivityNoteImportHash(`#top=ignored&v=ignored&note=${encodeURIComponent('kept')}`),
    ).toBe('kept');
  });

  it('returns null for a present but empty `note`', () => {
    expect(parseActivityNoteImportHash('#note=%20%0A&v=x')).toBeNull();
  });

  it('builds variants without `top`', () => {
    expect(parseActivityNoteImportHash('#v=one&v=two')).toBe(
      '**A**\n```\none\n```\n\n**B**\n```\ntwo\n```',
    );
  });

  it('keeps `top` alone when there are no variants', () => {
    expect(parseActivityNoteImportHash('#top=%20Just%20context%20')).toBe('Just context');
  });

  it('keeps the variant text exactly (inner whitespace, markdown, newlines)', () => {
    const variant = '  *not bold*\n\n<b>raw</b>  ';
    expect(parseActivityNoteImportHash(`#v=${encodeURIComponent(variant)}`)).toBe(
      `**A**\n\`\`\`\n${variant}\n\`\`\``,
    );
  });

  it('skips blank variants', () => {
    expect(parseActivityNoteImportHash('#v=%20&v=real')).toBe('**A**\n```\nreal\n```');
  });

  it('lengthens the fence past any backtick run in the variant', () => {
    const variant = 'use ```js``` and ````four````';
    expect(parseActivityNoteImportHash(`#v=${encodeURIComponent(variant)}`)).toBe(
      `**A**\n\`\`\`\`\`\n${variant}\n\`\`\`\`\``,
    );
  });

  it('decodes `+` as a space (URLSearchParams form encoding)', () => {
    expect(parseActivityNoteImportHash('#note=a+b')).toBe('a b');
  });

  it('returns null when the result is longer than the note limit', () => {
    const tooLong = 'x'.repeat(ACTIVITY_NOTE_BODY_MAX_CHARS + 1);
    expect(parseActivityNoteImportHash(`#note=${tooLong}`)).toBeNull();
    expect(parseActivityNoteImportHash(`#v=${tooLong}`)).toBeNull();
  });

  it('accepts a note at exactly the limit', () => {
    const exact = 'x'.repeat(ACTIVITY_NOTE_BODY_MAX_CHARS);
    expect(parseActivityNoteImportHash(`#note=${exact}`)).toBe(exact);
  });

  it.each(['', '#', '#foo=bar', '#top=&v=', '#%%%', '#section-2', '#v'])(
    'returns null for %p',
    (hash) => {
      expect(parseActivityNoteImportHash(hash)).toBeNull();
    },
  );

  it('does not throw on malformed percent-encoding', () => {
    expect(() => parseActivityNoteImportHash('#note=%E0%A4%A')).not.toThrow();
  });
});

describe('fencedCodeBlock', () => {
  it('uses three backticks by default', () => {
    expect(fencedCodeBlock('plain')).toBe('```\nplain\n```');
  });

  it('uses one more backtick than the longest run', () => {
    expect(fencedCodeBlock('a ``` b')).toBe('````\na ``` b\n````');
  });
});

describe('variantLabel', () => {
  it.each([
    [0, 'A'],
    [1, 'B'],
    [25, 'Z'],
    [26, 'AA'],
    [27, 'AB'],
  ])('%i → %s', (index, label) => {
    expect(variantLabel(index)).toBe(label);
  });
});
