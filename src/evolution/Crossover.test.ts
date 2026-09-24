import { describe, expect, it } from 'vitest';
import foundersJson from '../data/founders.v0.1.json';
import type { MusicGenome } from '../genome/MusicGenome';
import { validateMusicGenome } from '../genome/validateMusicGenome';
import { crossoverGenomes } from './Crossover';

const founders = foundersJson as unknown as MusicGenome[];

describe('modular crossover', () => {
  it('deterministically creates a valid child inheriting both parents', () => {
    const left = founders[3];
    const right = founders[28];
    const first = crossoverGenomes(left, right, 'child', 'crossover-seed');
    const second = crossoverGenomes(left, right, 'child', 'crossover-seed');

    expect(first).toEqual(second);
    expect(validateMusicGenome(first)).toEqual([]);
    expect(first.lineage.parents).toEqual([left.id, right.id]);
    expect([left.bass, right.bass]).toContainEqual(first.bass);
    expect([left.closedHat, right.closedHat]).toContainEqual(first.closedHat);
    const bassFromLeft =
      JSON.stringify(first.bass) === JSON.stringify(left.bass);
    expect(first.closedHat).toEqual(
      bassFromLeft ? right.closedHat : left.closedHat,
    );
  });
});
