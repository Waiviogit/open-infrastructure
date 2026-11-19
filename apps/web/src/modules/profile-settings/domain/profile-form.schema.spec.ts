import { emptyProfileFormValues, profileFormValuesFromProfile } from './profile-fields';
import {
  buildProfilePatch,
  parseProfilePatch,
  validateProfileForm,
  validateProfileValue,
} from './profile-form.schema';

describe('profile form schema', () => {
  describe('validateProfileValue', () => {
    it.each([
      ['twitter', 'neo.agent_1'],
      ['whatsapp', '+380501234567'],
      ['bitcoin', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'],
      ['bitcoin', '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'],
      ['litecoin', 'LZ3XQ6m4x9Wvq7aGJr3h8m2c7DgK7pX1aB'],
      ['ethereum', '0x52908400098527886E0F7030069857D2E4169EE7'],
      ['lightningBitcoin', 'neo@getalby.com'],
      ['email', 'neo@example.com'],
      ['website', 'example.com/about'],
      ['profile_image', 'https://content.example/ipfs-gateway/content/image/Qm1'],
      ['about', 'anything goes'],
    ] as const)('accepts %s = %s', (field, value) => {
      expect(validateProfileValue(field, value)).toBeNull();
    });

    it.each([
      ['twitter', 'https://x.com/neo', 'social_invalid'],
      ['whatsapp', 'call me', 'whatsapp_invalid'],
      ['bitcoin', '0x52908400098527886E0F7030069857D2E4169EE7', 'wallet_invalid'],
      ['ethereum', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'wallet_invalid'],
      ['lightningBitcoin', 'neo', 'wallet_invalid'],
      ['email', 'neo@', 'email_invalid'],
      ['website', 'not a url', 'url_invalid'],
      ['profile_image', 'content.example/a.png', 'url_invalid'],
    ] as const)('rejects %s = %s', (field, value, code) => {
      expect(validateProfileValue(field, value)).toBe(code);
    });

    it('accepts an empty value for every field (it removes the key)', () => {
      expect(validateProfileValue('ethereum', '')).toBeNull();
    });
  });

  describe('buildProfilePatch', () => {
    it('sends only changed fields, normalized, with null for cleared ones', () => {
      const initial = profileFormValuesFromProfile({
        name: 'Neo',
        location: 'Kyiv',
        twitter: 'old',
      });
      const current = {
        ...initial,
        name: '  Neo  ',
        location: '',
        twitter: '@neo',
        signature: 'Thanks!',
      };

      expect(buildProfilePatch(initial, current)).toEqual({
        location: null,
        twitter: 'neo',
        signature: 'Thanks!',
      });
    });
  });

  describe('validateProfileForm', () => {
    it('ignores an invalid legacy value the user did not touch', () => {
      const initial = profileFormValuesFromProfile({ lightningBitcoin: 'legacy_handle' });
      const current = { ...initial, name: 'Neo' };

      expect(validateProfileForm(initial, current)).toEqual({});
    });

    it('reports a changed invalid value', () => {
      const initial = emptyProfileFormValues();
      const current = { ...initial, ethereum: '0x123' };

      expect(validateProfileForm(initial, current)).toEqual({ ethereum: 'wallet_invalid' });
    });
  });

  describe('parseProfilePatch', () => {
    it('normalizes values and maps empty strings to null', () => {
      expect(parseProfilePatch({ twitter: ' @neo ', about: '', website: null })).toEqual({
        twitter: 'neo',
        about: null,
        website: null,
      });
    });

    it('rejects unknown keys and invalid values', () => {
      expect(parseProfilePatch({ __proto__: 'x', admin: 'yes' })).toBeNull();
      expect(parseProfilePatch({ ethereum: 'nope' })).toBeNull();
      expect(parseProfilePatch('not an object')).toBeNull();
    });
  });
});
