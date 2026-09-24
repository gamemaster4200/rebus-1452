import { describe, expect, it } from 'vitest';
import foundersJson from '../data/founders.v0.1.json';
import ratingsJson from '../data/generation-0-ratings.v1.json';
import type { MusicGenome } from '../genome/MusicGenome';
import { SeededRng } from '../random/SeededRng';
import { FITNESS_WEIGHTS, GENERATION_1_CONFIG } from './GenerationConfig';
import type { CanonicalRatingsDataset } from './GenerationTypes';
import { ratingMap, selectParentPair, selectionWeight } from './Selection';

const founders = foundersJson as unknown as MusicGenome[];
const ratings = ratingsJson as CanonicalRatingsDataset;

describe('generation 1 selection', () => {
  it('uses the canonical human fitness weights', () => {
    expect(FITNESS_WEIGHTS).toEqual({
      '-2': 0.1,
      '-1': 0.35,
      '0': 0.75,
      '1': 1.5,
      '2': 3,
    });
    expect(selectionWeight(founders[3], 2, 0, 0, GENERATION_1_CONFIG)).toBe(3);
  });

  it('selects deterministically while enforcing parent-use caps', () => {
    const select = () => {
      const usage = new Map<string, number>();
      const scores = ratingMap(ratings.ratings);
      const pairs = Array.from({ length: 20 }, (_, index) =>
        selectParentPair(
          founders,
          scores,
          usage,
          GENERATION_1_CONFIG,
          new SeededRng(`selection-test:${index}`),
        ).map((parent) => parent.id),
      );
      return { pairs, usage };
    };

    const first = select();
    const second = select();
    expect(first.pairs).toEqual(second.pairs);
    expect(Math.max(...first.usage.values())).toBeLessThanOrEqual(
      GENERATION_1_CONFIG.maxParentUses,
    );
    expect(
      new Set(
        first.pairs
          .flat()
          .map((id) => founders.find((g) => g.id === id)?.family),
      ).size,
    ).toBeGreaterThanOrEqual(6);
  });
});
