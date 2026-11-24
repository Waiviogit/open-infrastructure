import { createTranslator } from './create-translator';

const messages = {
  hello: 'Hello {name}',
  plain: 'Plain',
  files_zero: 'No files',
  files_one: '{count} file',
  files_few: '{count} files (few)',
  files_many: '{count} files (many)',
  files_other: '{count} files',
};

describe('createTranslator', () => {
  const en = createTranslator(messages, 'en-US');
  const ru = createTranslator(messages, 'ru-RU');
  const ja = createTranslator(messages, 'ja-JP');
  const t = en as unknown as (key: string, values?: Record<string, string | number>) => string;

  it('returns the text or the key itself', () => {
    expect(t('plain')).toBe('Plain');
    expect(t('missing_key')).toBe('missing_key');
  });

  it('fills placeholders', () => {
    expect(t('hello', { name: 'Ann' })).toBe('Hello Ann');
  });

  it('picks the CLDR plural form of the locale', () => {
    const tRu = ru as unknown as typeof t;
    expect(t('files', { count: 1 })).toBe('1 file');
    expect(t('files', { count: 3 })).toBe('3 files');
    expect(tRu('files', { count: 3 })).toBe('3 files (few)');
    expect(tRu('files', { count: 5 })).toBe('5 files (many)');
    expect(tRu('files', { count: 21 })).toBe('21 file');
  });

  it('uses the zero form for a count of 0', () => {
    expect(t('files', { count: 0 })).toBe('No files');
  });

  it('falls back to the other form when the category is missing', () => {
    const tJa = ja as unknown as typeof t;
    expect(tJa('files', { count: 1 })).toBe('1 files');
  });

  it('treats a non-plural key with a count as a plain message', () => {
    expect(t('hello', { name: 'Bo', count: 2 })).toBe('Hello Bo');
  });
});
