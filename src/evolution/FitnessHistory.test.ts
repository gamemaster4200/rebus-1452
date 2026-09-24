import { describe, expect, it } from 'vitest';
import foundersJson from '../data/founders.v0.1.json';
import generation1Json from '../data/generation-1.v0.1.json';
import generation0RatingsJson from '../data/generation-0-ratings.v1.json';
import type { MusicGenome } from '../genome/MusicGenome';
import type { PopulationRatingsDataset } from './GenerationTypes';
import {
  aggregateEffectiveFitness,
  buildFitnessHistory,
  FITNESS_POLICY_VERSION,
  fitnessMapForPopulation,
  fitnessWeight,
  PHENOTYPE_FITNESS_HISTORY_V1,
  phenotypeHash,
  type FitnessObservation,
} from './FitnessHistory';

const founders = foundersJson as unknown as MusicGenome[];
const generation1 = generation1Json as unknown as MusicGenome[];
const generation0Ratings =
  generation0RatingsJson as unknown as PopulationRatingsDataset;

describe('phenotype fitness history', () => {
  it('owns the complete immutable v1 score-to-weight policy', () => {
    expect(PHENOTYPE_FITNESS_HISTORY_V1).toEqual({
      version: 'phenotype-fitness-history-v1',
      scoreWeights: {
        '-2': 0.1,
        '-1': 0.35,
        '0': 0.75,
        '1': 1.5,
        '2': 3,
      },
    });
    expect(FITNESS_POLICY_VERSION).toBe('phenotype-fitness-history-v1');
    expect(
      [-2, -1, 0, 1, 2].map((score) =>
        fitnessWeight(score as -2 | -1 | 0 | 1 | 2),
      ),
    ).toEqual([0.1, 0.35, 0.75, 1.5, 3]);
  });

  it('ignores identity while hashing the complete compiled phenotype', () => {
    const source = founders[0];
    const renamed: MusicGenome = {
      ...structuredClone(source),
      id: 'same-sound-new-id',
      lineage: { ...source.lineage, generation: 9 },
    };
    expect(phenotypeHash(renamed)).toBe(phenotypeHash(source));

    const changed: MusicGenome = {
      ...structuredClone(source),
      sound: {
        ...source.sound,
        filterCutoff: source.sound.filterCutoff + 137,
      },
    };
    expect(phenotypeHash(changed)).not.toBe(phenotypeHash(source));
  });

  it('matches every exact founder/elite playback phenotype', () => {
    generation1.slice(0, 7).forEach((elite) => {
      const source = founders.find(
        (founder) => founder.id === elite.lineage.sourceGenomeId,
      );
      expect(source).toBeDefined();
      expect(phenotypeHash(elite)).toBe(phenotypeHash(source as MusicGenome));
    });
  });

  it('averages mapped weights and preserves every generation observation', () => {
    const hash = 'SAME-PHENOTYPE';
    const observations: FitnessObservation[] = [
      {
        phenotypeHash: hash,
        generation: 0,
        datasetVersion: 'v0.1',
        datasetSha256: 'G0',
        genomeId: 'founder-001',
        score: 2,
      },
      {
        phenotypeHash: hash,
        generation: 1,
        datasetVersion: 'v0.1',
        datasetSha256: 'G1',
        genomeId: 'gen1-001',
        score: 1,
      },
      {
        phenotypeHash: 'ONE-OBSERVATION',
        generation: 1,
        datasetVersion: 'v0.1',
        datasetSha256: 'G1',
        genomeId: 'gen1-002',
        score: -1,
      },
    ];
    expect(aggregateEffectiveFitness(observations).get(hash)).toBe(2.25);
    expect(aggregateEffectiveFitness(observations).get('ONE-OBSERVATION')).toBe(
      0.35,
    );
    expect(observations.map(({ generation }) => generation)).toEqual([0, 1, 1]);
  });

  it('assigns source fitness by phenotype hash rather than genome ID', () => {
    const observations = buildFitnessHistory([
      { population: founders, ratings: generation0Ratings },
    ]);
    const effective = aggregateEffectiveFitness(observations);
    const elite = generation1[0];
    const fitness = fitnessMapForPopulation([elite], effective);
    expect(elite.id).not.toBe(elite.lineage.sourceGenomeId);
    expect(fitness.get(elite.id)).toBe(3);
  });
});
