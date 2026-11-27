import { clamp } from '../src/util/math';

describe('clamp', () => {
  it('returns the value when it is within the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('returns the minimum when the value is below the range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('returns the maximum when the value is above the range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns the minimum when the value equals the minimum', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns the maximum when the value equals the maximum', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});
