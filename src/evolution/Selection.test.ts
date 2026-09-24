import { describe, expect, it } from 'vitest';
import foundersJson from '../data/founders.v0.1.json';
import ratingsJson from '../data/generation-0-ratings.v1.json';
import type { MusicGenome } from '../genome/MusicGenome';
import { SeededRng } from '../random/SeededRng';
import {
  FITNESS_WEIGHTS,
  GENERATION_1_CONFIG,
  GENERATION_2_CONFIG,
} from './GenerationConfig';
import {
  featureDistance,
  selectParentPair,
  selectionWeight,
} from './Selection';

const founders = foundersJson as unknown as MusicGenome[];
const ratings = ratingsJson;
const baseFitness = new Map(
  ratings.ratings.map((rating) => [
    rating.genomeId,
    FITNESS_WEIGHTS[rating.score as keyof typeof FITNESS_WEIGHTS],
  ]),
);

describe('generation 1 selection', () => {
  it('enables founder-family pressure only for G0 to G1', () => {
    expect(GENERATION_1_CONFIG.useFounderFamilyPressure).toBe(true);
    expect(GENERATION_2_CONFIG.useFounderFamilyPressure).toBe(false);
  });

  it('uses the canonical human fitness weights', () => {
    expect(FITNESS_WEIGHTS).toEqual({
      '-2': 0.1,
      '-1': 0.35,
      '0': 0.75,
      '1': 1.5,
      '2': 3,
    });
    expect(selectionWeight(founders[3], 3, 0, 0, GENERATION_1_CONFIG)).toBe(3);
  });

  it('ignores family labels completely when family pressure is disabled', () => {
    const candidate = founders[0];
    const sameFamilyCounterpart = {
      ...structuredClone(founders[1]),
      family: candidate.family,
    };
    const otherFamilyCounterpart = {
      ...structuredClone(sameFamilyCounterpart),
      family: founders.find((genome) => genome.family !== candidate.family)
        ?.family,
    };
    expect(
      selectionWeight(
        candidate,
        1.5,
        1,
        7,
        GENERATION_2_CONFIG,
        sameFamilyCounterpart,
      ),
    ).toBe(
      selectionWeight(
        candidate,
        1.5,
        1,
        0,
        GENERATION_2_CONFIG,
        otherFamilyCounterpart,
      ),
    );
  });

  it('keeps actual feature distance in crossover diversity weighting', () => {
    const candidate = founders[0];
    const nearCounterpart = {
      ...structuredClone(candidate),
      id: 'near-counterpart',
    };
    const farCounterpart = founders
      .map((genome) => ({
        genome,
        distance: featureDistance(candidate, genome),
      }))
      .sort((left, right) => right.distance - left.distance)[0].genome;
    expect(
      selectionWeight(
        candidate,
        1.5,
        0,
        0,
        GENERATION_2_CONFIG,
        farCounterpart,
      ),
    ).toBeGreaterThan(
      selectionWeight(
        candidate,
        1.5,
        0,
        0,
        GENERATION_2_CONFIG,
        nearCounterpart,
      ),
    );
  });

  it('retains the original G1 family protection and cross-family boost', () => {
    const candidate = founders[0];
    const sameFamilyCounterpart = {
      ...structuredClone(founders[1]),
      family: candidate.family,
    };
    const otherFamilyCounterpart = {
      ...structuredClone(sameFamilyCounterpart),
      family: founders.find((genome) => genome.family !== candidate.family)
        ?.family,
    };
    expect(
      selectionWeight(
        candidate,
        1.5,
        0,
        3,
        GENERATION_1_CONFIG,
        otherFamilyCounterpart,
      ),
    ).toBeLessThan(
      selectionWeight(
        candidate,
        1.5,
        0,
        0,
        GENERATION_1_CONFIG,
        otherFamilyCounterpart,
      ),
    );
    expect(
      selectionWeight(
        candidate,
        1.5,
        0,
        0,
        GENERATION_1_CONFIG,
        otherFamilyCounterpart,
      ),
    ).toBeGreaterThan(
      selectionWeight(
        candidate,
        1.5,
        0,
        0,
        GENERATION_1_CONFIG,
        sameFamilyCounterpart,
      ),
    );
  });

  it('selects deterministically while enforcing parent-use caps', () => {
    const select = () => {
      const usage = new Map<string, number>();
      const pairs = Array.from({ length: 20 }, (_, index) =>
        selectParentPair(
          founders,
          baseFitness,
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
