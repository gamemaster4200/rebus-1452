import { analyzeFounderDiversity } from '../founders/Diversity';
import type { MusicGenome } from '../genome/MusicGenome';
import { GENERATION_1_CONFIG, type GenerationConfig } from './GenerationConfig';
import type { CanonicalRatingsDataset } from './GenerationTypes';
import {
  generateNextGeneration,
  validateNextGeneration,
} from './NextGeneration';
import { featureDistance } from './Selection';

export interface Generation1Report {
  readonly parentUses: Readonly<Record<string, number>>;
  readonly diversity: ReturnType<typeof analyzeFounderDiversity>;
  readonly mutationScales: Readonly<Record<'micro' | 'meso' | 'macro', number>>;
  readonly mutationCategories: Readonly<
    Record<'rhythm' | 'pitch' | 'sound' | 'development', number>
  >;
}

/** Canonical Generation 1 input bound to the reusable next-generation engine. */
export function generateGeneration1(
  founders: readonly MusicGenome[],
  ratings: CanonicalRatingsDataset,
  config: GenerationConfig = GENERATION_1_CONFIG,
): MusicGenome[] {
  const generation = generateNextGeneration(founders, ratings, config);
  const errors = validateGeneration1(generation, founders, config);
  if (errors.length > 0) {
    throw new Error(`Generation 1 validation failed: ${errors.join(' ')}`);
  }
  return generation;
}

/** Canonical G1 diversity checks layered over generic generation validation. */
export function validateGeneration1(
  generation: readonly MusicGenome[],
  founders: readonly MusicGenome[],
  config: GenerationConfig = GENERATION_1_CONFIG,
): string[] {
  const errors = validateNextGeneration(generation, founders, config);
  const diversity = analyzeFounderDiversity(generation);
  if (diversity.meanDistance < 0.16) {
    errors.push('Generation 1 feature space is too concentrated.');
  }
  if (diversity.minimumDistance < 0.015) {
    errors.push('Generation 1 contains nearly identical descendants.');
  }

  const immigrants = generation.filter(
    (genome) => genome.lineage.originType === 'immigrant',
  );
  if (
    !immigrants.some(
      (genome) =>
        Math.min(
          ...founders.map((founder) => featureDistance(genome, founder)),
        ) > 0.08,
    )
  ) {
    errors.push(
      'Immigrants do not extend beyond the immediate founder neighborhoods.',
    );
  }
  return [...new Set(errors)];
}

export function generation1Report(
  generation: readonly MusicGenome[],
): Generation1Report {
  const parentUses: Record<string, number> = {};
  const mutationScales = { micro: 0, meso: 0, macro: 0 };
  const mutationCategories = { rhythm: 0, pitch: 0, sound: 0, development: 0 };
  generation.forEach((genome) => {
    if (
      genome.lineage.originType === 'crossover' ||
      genome.lineage.originType === 'mutation'
    ) {
      genome.lineage.parents.forEach((parent) => {
        parentUses[parent] = (parentUses[parent] ?? 0) + 1;
      });
    }
    genome.lineage.mutations?.forEach((mutation) => {
      mutationScales[mutation.scale] += 1;
      mutationCategories[mutation.category] += 1;
    });
  });
  return {
    parentUses,
    diversity: analyzeFounderDiversity(generation),
    mutationScales,
    mutationCategories,
  };
}
