import { analyzeFounderDiversity } from '../founders/Diversity';
import type { MusicGenome } from '../genome/MusicGenome';
import { GENERATION_2_CONFIG, type GenerationConfig } from './GenerationConfig';
import type { CanonicalRatingsDataset } from './GenerationTypes';
import { derivePopulationFitness } from './FitnessHistory';
import {
  generateNextGeneration,
  validateNextGeneration,
} from './NextGeneration';
import { featureDistance } from './Selection';
import { generation1Report, type Generation1Report } from './Generation1';

export type Generation2Report = Generation1Report;

export function generation2Fitness(
  founders: readonly MusicGenome[],
  generation0Ratings: CanonicalRatingsDataset,
  generation1: readonly MusicGenome[],
  generation1Ratings: CanonicalRatingsDataset,
): ReadonlyMap<string, number> {
  return derivePopulationFitness(generation1, [
    { population: founders, ratings: generation0Ratings },
    { population: generation1, ratings: generation1Ratings },
  ]);
}

export function generateGeneration2(
  founders: readonly MusicGenome[],
  generation0Ratings: CanonicalRatingsDataset,
  generation1: readonly MusicGenome[],
  generation1Ratings: CanonicalRatingsDataset,
  config: GenerationConfig = GENERATION_2_CONFIG,
): MusicGenome[] {
  const baseFitness = generation2Fitness(
    founders,
    generation0Ratings,
    generation1,
    generation1Ratings,
  );
  const generation = generateNextGeneration(generation1, baseFitness, config);
  const errors = validateGeneration2(generation, generation1, config);
  if (errors.length > 0) {
    throw new Error(`Generation 2 validation failed: ${errors.join(' ')}`);
  }
  return generation;
}

export function validateGeneration2(
  generation: readonly MusicGenome[],
  generation1: readonly MusicGenome[],
  config: GenerationConfig = GENERATION_2_CONFIG,
): string[] {
  const errors = validateNextGeneration(generation, generation1, config);
  const diversity = analyzeFounderDiversity(generation);
  if (diversity.meanDistance < 0.16) {
    errors.push('Generation 2 feature space is too concentrated.');
  }
  let nearPairCount = 0;
  generation.forEach((left, leftIndex) => {
    generation.slice(leftIndex + 1).forEach((right) => {
      if (featureDistance(left, right) < 0.015) nearPairCount += 1;
    });
  });
  if (nearPairCount > 4) {
    errors.push('Generation 2 contains too many nearly identical descendants.');
  }
  const immigrants = generation.filter(
    (genome) => genome.lineage.originType === 'immigrant',
  );
  if (
    !immigrants.some(
      (genome) =>
        Math.min(
          ...generation1.map((source) => featureDistance(genome, source)),
        ) > 0.08,
    )
  ) {
    errors.push('Immigrants do not extend beyond the source neighborhoods.');
  }
  return [...new Set(errors)];
}

export function generation2Report(
  generation: readonly MusicGenome[],
): Generation2Report {
  return generation1Report(generation);
}
