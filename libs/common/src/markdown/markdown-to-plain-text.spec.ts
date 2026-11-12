import { markdownToPlainText } from './markdown-to-plain-text';

describe('markdownToPlainText', () => {
  it('returns an empty string for empty or blank input', () => {
    expect(markdownToPlainText('')).toBe('');
    expect(markdownToPlainText('  \n\n\t ')).toBe('');
  });

  it('keeps plain text and joins lines and blocks with single spaces', () => {
    expect(
      markdownToPlainText('Hello\nworld\r\n\r\n\r\nSecond   paragraph  '),
    ).toBe('Hello world Second paragraph');
  });

  describe('code', () => {
    it('keeps fenced code text without fences or info string', () => {
      expect(
        markdownToPlainText(
          'Before\n```ts\nconst a = 1;\nconst b = 2;\n```\nAfter',
        ),
      ).toBe('Before const a = 1; const b = 2; After');
    });

    it('supports tilde fences and an unclosed fence', () => {
      expect(markdownToPlainText('~~~\nx\n~~~')).toBe('x');
      expect(markdownToPlainText('Text\n```\nopen code')).toBe(
        'Text open code',
      );
    });

    it('keeps markup inside code literally', () => {
      expect(
        markdownToPlainText(
          '```\n# not a heading\n- not a list\n**bold** ||x|| <div>\n```',
        ),
      ).toBe('# not a heading - not a list **bold** ||x|| <div>');
      expect(markdownToPlainText('Use `**raw**` and `a_b_c` or `<br>`')).toBe(
        'Use **raw** and a_b_c or <br>',
      );
    });

    it('drops inline code backticks, including double-backtick spans', () => {
      expect(markdownToPlainText('Run `pnpm test` then ``a ` b``')).toBe(
        'Run pnpm test then a ` b',
      );
    });
  });

  describe('block markers', () => {
    it('drops heading markers but keeps line-start hashtags', () => {
      expect(markdownToPlainText('# Title\n## Sub ##\n#hashtag text')).toBe(
        'Title Sub #hashtag text',
      );
    });

    it('drops unordered, ordered and task list markers', () => {
      expect(
        markdownToPlainText(
          '- one\n* two\n+ three\n1. four\n2) five\n  - nested\n- [x] done',
        ),
      ).toBe('one two three four five nested done');
    });

    it('keeps text that only looks like a marker', () => {
      expect(markdownToPlainText('-5 degrees, 1.5 kg, +1 vote')).toBe(
        '-5 degrees, 1.5 kg, +1 vote',
      );
    });

    it('drops blockquote markers, including nested quotes', () => {
      expect(markdownToPlainText('> quoted\n>> deeper\n> - item')).toBe(
        'quoted deeper item',
      );
    });

    it('drops horizontal rules and setext underlines', () => {
      expect(
        markdownToPlainText('One\n\n---\n\n***\n\n_ _ _\nTitle\n===\nTwo'),
      ).toBe('One Title Two');
    });

    it('drops reference link definitions', () => {
      expect(
        markdownToPlainText('See [docs][1]\n\n[1]: https://example.com'),
      ).toBe('See docs');
    });
  });

  describe('tables', () => {
    it('joins cells with a middle dot and drops the separator row', () => {
      expect(
        markdownToPlainText(
          '| Name | Price |\n|---|:---:|\n| **Tea** | $2 |\n| Coffee | $3 |',
        ),
      ).toBe('Name · Price Tea · $2 Coffee · $3');
    });

    it('handles tables without outer pipes and skips empty cells', () => {
      expect(markdownToPlainText('a | b\n--- | ---\n1 | \nafter')).toBe(
        'a · b 1 after',
      );
    });

    it('keeps escaped pipes and pipes inside code as cell text', () => {
      expect(markdownToPlainText('| a \\| b | `x|y` |\n| - | - |')).toBe(
        'a | b · x|y',
      );
    });

    it('leaves a pipe in a normal sentence alone', () => {
      expect(markdownToPlainText('this | that')).toBe('this | that');
    });
  });

  describe('links, images and HTML', () => {
    it('keeps link text and drops the URL', () => {
      expect(
        markdownToPlainText(
          'Read [the post](https://example.com/a "Title") and [wiki](https://w.org/Foo_(bar)) now',
        ),
      ).toBe('Read the post and wiki now');
    });

    it('drops images, including linked images', () => {
      expect(
        markdownToPlainText(
          'Look ![cover](https://img.example/a.jpg) [![](https://img.example/p.jpg)](https://3speak.tv/watch?v=a) done',
        ),
      ).toBe('Look done');
    });

    it('keeps bare URLs and autolink targets', () => {
      expect(
        markdownToPlainText(
          'Go https://example.com/x_y or <https://example.com/z>',
        ),
      ).toBe('Go https://example.com/x_y or https://example.com/z');
    });

    it('drops HTML tags (also multi-line ones) and comments but keeps their text', () => {
      expect(
        markdownToPlainText(
          '<center><img src="https://img.example/a.jpg" /></center>\n<p class="x">Hello<br/>there</p><!-- note -->\n<div\n  class="pull-left">Side</div>',
        ),
      ).toBe('Hello there Side');
    });

    it('keeps angle brackets that are not tags', () => {
      expect(markdownToPlainText('I <3 this, 2 < 5')).toBe('I <3 this, 2 < 5');
    });
  });

  describe('spoilers', () => {
    it('replaces inline spoiler content with an ellipsis', () => {
      expect(markdownToPlainText('The ending: ||he dies|| and more')).toBe(
        'The ending: … and more',
      );
    });

    it('hides multi-line block spoilers without revealing any of their text', () => {
      const plain = markdownToPlainText(
        'Intro\n\n||secret line\n\n- secret item `secret code`\n**secret** [link](https://x.y)||\n\nOutro',
      );
      expect(plain).toBe('Intro … Outro');
      expect(plain).not.toContain('secret');
    });

    it('keeps double pipes inside code as code text', () => {
      expect(
        markdownToPlainText('```\nif (a || b || c) {}\n```\nand `x || y`'),
      ).toBe('if (a || b || c) {} and x || y');
    });

    it('does not treat escaped pipes as a spoiler', () => {
      expect(markdownToPlainText('a \\|\\|b\\|\\| c')).toBe('a ||b|| c');
    });
  });

  describe('emphasis', () => {
    it('drops bold, italic and strikethrough markers', () => {
      expect(
        markdownToPlainText(
          '**bold** __strong__ *italic* _em_ ~~gone~~ ***both*** **_mixed_**',
        ),
      ).toBe('bold strong italic em gone both mixed');
    });

    it('keeps intraword underscores and hashtags with underscores', () => {
      expect(
        markdownToPlainText(
          'snake_case_name and #my_tag_here plus слово_тест_слово',
        ),
      ).toBe('snake_case_name and #my_tag_here plus слово_тест_слово');
    });

    it('keeps lone asterisks that are not emphasis', () => {
      expect(markdownToPlainText('5 * 3 * 2 = 30')).toBe('5 * 3 * 2 = 30');
    });
  });

  describe('escapes', () => {
    it('unescapes markdown escapes and keeps the escaped characters literal', () => {
      expect(
        markdownToPlainText(
          '\\# not heading, \\*not italic\\*, a\\_b, 1\\. item, \\[x\\]',
        ),
      ).toBe('# not heading, *not italic*, a_b, 1. item, [x]');
    });

    it('keeps a lone backslash before a non-punctuation character', () => {
      expect(markdownToPlainText('C:\\Users\\me')).toBe('C:\\Users\\me');
    });
  });

  it('flattens a mixed message into a single preview line', () => {
    const markdown = [
      '## Weekly update',
      '',
      'We shipped **three** things:',
      '',
      '1. A [new editor](https://example.com/editor)',
      '2. `markdownToPlainText`',
      '3. ||a surprise||',
      '',
      '![shot](https://img.example/s.png)',
      '',
      '> Thanks @alice for #open_infra',
    ].join('\n');
    expect(markdownToPlainText(markdown)).toBe(
      'Weekly update We shipped three things: A new editor markdownToPlainText … Thanks @alice for #open_infra',
    );
  });
});
