import type { MusicGenome } from '../genome/MusicGenome';
import {
  GENOME_FEATURE_KEYS,
  extractGenomeFeatures,
  genomeFeatureVector,
  type GenomeFeatureKey,
} from './GenomeFeatures';

export interface DiversityReport {
  readonly minimumDistance: number;
  readonly meanDistance: number;
  readonly axisRanges: Readonly<Record<GenomeFeatureKey, number>>;
}

function distance(left: readonly number[], right: readonly number[]): number {
  const squared = left.reduce((total, value, index) => {
    const difference = value - right[index];
    return total + difference * difference;
  }, 0);
  return Math.sqrt(squared / left.length);
}

export function analyzeFounderDiversity(
  genomes: readonly MusicGenome[],
): DiversityReport {
  if (genomes.length < 2) {
    throw new Error('Diversity analysis requires at least two genomes.');
  }

  const vectors = genomes.map(genomeFeatureVector);
  const distances: number[] = [];
  for (let left = 0; left < vectors.length; left += 1) {
    for (let right = left + 1; right < vectors.length; right += 1) {
      distances.push(distance(vectors[left], vectors[right]));
    }
  }

  const featureSets = genomes.map(extractGenomeFeatures);
  const axisRanges = Object.fromEntries(
    GENOME_FEATURE_KEYS.map((key) => {
      const values = featureSets.map((features) => features[key]);
      return [key, Math.max(...values) - Math.min(...values)];
    }),
  ) as Record<GenomeFeatureKey, number>;

  return {
    minimumDistance: Math.min(...distances),
    meanDistance:
      distances.reduce((total, value) => total + value, 0) / distances.length,
    axisRanges,
  };
}

export function validateFounderDiversity(
  genomes: readonly MusicGenome[],
): string[] {
  const report = analyzeFounderDiversity(genomes);
  const errors: string[] = [];

  if (report.minimumDistance < 0.045) {
    errors.push(
      'At least two founders are too close in normalized feature space.',
    );
  }
  if (report.meanDistance < 0.2) {
    errors.push('Founder population is too concentrated in feature space.');
  }

  const minimumAxisRanges: Partial<Record<GenomeFeatureKey, number>> = {
    bassDensity: 0.35,
    bassPitchVariety: 0.65,
    hatDensity: 0.35,
    percussionDensity: 0.45,
    syncopation: 0.25,
    brightness: 0.55,
    roughness: 0.45,
    space: 0.45,
    developmentAmount: 0.2,
    mutationRate: 0.7,
  };
  Object.entries(minimumAxisRanges).forEach(([key, minimum]) => {
    if (report.axisRanges[key as GenomeFeatureKey] < minimum) {
      errors.push(`${key} does not span enough of the Style Envelope.`);
    }
  });

  return errors;
}
