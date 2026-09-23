import { describe, expect, it } from 'vitest';
import { SeededRng } from './SeededRng';

function sequence(seed: string): number[] {
  const rng = new SeededRng(seed);
  return Array.from({ length: 12 }, () => rng.next());
}

describe('SeededRng', () => {
  it('returns the same sequence for the same seed', () => {
    expect(sequence('same-seed')).toEqual(sequence('same-seed'));
  });

  it('returns a different sequence for a different seed', () => {
    expect(sequence('seed-a')).not.toEqual(sequence('seed-b'));
  });
});
