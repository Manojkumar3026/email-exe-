import { describe, expect, it } from 'vitest';
import { chunk } from '../../src/lib/util/chunk';

describe('chunk', () => {
  it('splits an array into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when size exceeds length', () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunk([], 5)).toEqual([]);
  });

  it('throws for a non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});
