import {
  decodeWeightObjectCursor,
  encodeWeightObjectCursor,
  isValidWeightObjectCursor,
} from './weight-object-cursor';

describe('weight-object-cursor', () => {
  it('round-trips weight and object_id', () => {
    const payload = { weight: 12.5, object_id: 'obj-1' };
    const encoded = encodeWeightObjectCursor(payload);
    expect(decodeWeightObjectCursor(encoded)).toEqual(payload);
  });

  it('round-trips null weight', () => {
    const payload = { weight: null, object_id: 'obj-2' };
    const encoded = encodeWeightObjectCursor(payload);
    expect(decodeWeightObjectCursor(encoded)).toEqual(payload);
  });

  it('rejects invalid cursor', () => {
    expect(decodeWeightObjectCursor('')).toBeNull();
    expect(decodeWeightObjectCursor('not-base64')).toBeNull();
    expect(decodeWeightObjectCursor(encodeWeightObjectCursor({ weight: 1, object_id: '' }))).toBeNull();
  });

  it('rejects a legacy bare object_id cursor', () => {
    expect(decodeWeightObjectCursor('wobj-123')).toBeNull();
    expect(isValidWeightObjectCursor('wobj-123')).toBe(false);
  });

  it('treats an absent cursor as valid and an encoded cursor as valid', () => {
    expect(isValidWeightObjectCursor(undefined)).toBe(true);
    expect(isValidWeightObjectCursor(encodeWeightObjectCursor({ weight: 3, object_id: 'a' }))).toBe(
      true,
    );
  });

  it('coerces string weight from JSON', () => {
    const encoded = Buffer.from(
      JSON.stringify({ weight: '12.5', object_id: 'obj-3' }),
      'utf8',
    ).toString('base64url');
    expect(decodeWeightObjectCursor(encoded)).toEqual({
      weight: 12.5,
      object_id: 'obj-3',
    });
  });
});
