import { isProfileAccountSegment } from './profile-account-segment';

describe('isProfileAccountSegment', () => {
  it.each(['alice', 'coffee.time', 'Alice', 'a-b-c', 'abc123'])('accepts %s', (segment) => {
    expect(isProfileAccountSegment(segment)).toBe(true);
  });

  it.each(['ab', 'a'.repeat(33), 'bad!name', 'with%20space', '%E0%A4%A'])('rejects %s', (segment) => {
    expect(isProfileAccountSegment(segment)).toBe(false);
  });
});
