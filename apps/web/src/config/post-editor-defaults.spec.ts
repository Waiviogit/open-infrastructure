import { isPostEditorGooglePlacesEnabled } from './post-editor-defaults';

jest.mock('server-only', () => ({}));

describe('isPostEditorGooglePlacesEnabled', () => {
  const original = process.env.POST_EDITOR_GOOGLE_PLACES_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.POST_EDITOR_GOOGLE_PLACES_ENABLED;
    } else {
      process.env.POST_EDITOR_GOOGLE_PLACES_ENABLED = original;
    }
  });

  it('is off when the variable is not set', () => {
    delete process.env.POST_EDITOR_GOOGLE_PLACES_ENABLED;
    expect(isPostEditorGooglePlacesEnabled()).toBe(false);
  });

  it.each(['false', '0', 'yes', ''])('is off for %j', (value) => {
    process.env.POST_EDITOR_GOOGLE_PLACES_ENABLED = value;
    expect(isPostEditorGooglePlacesEnabled()).toBe(false);
  });

  it.each(['true', ' TRUE '])('is on for %j', (value) => {
    process.env.POST_EDITOR_GOOGLE_PLACES_ENABLED = value;
    expect(isPostEditorGooglePlacesEnabled()).toBe(true);
  });
});
