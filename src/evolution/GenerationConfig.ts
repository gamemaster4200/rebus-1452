import type { FounderScore } from '../ratings/RatingRepository';

export const GENERATION_1_MASTER_SEED = 'rebus-1452-generation-1-v1';
export const GENERATION_1_DATASET_VERSION = 'v0.1';

export interface GenerationCounts {
  readonly elite: number;
  readonly crossover: number;
  readonly mutation: number;
  readonly immigrant: number;
}

export const GENERATION_1_COUNTS: GenerationCounts = {
  elite: 7,
  crossover: 24,
  mutation: 7,
  immigrant: 4,
} as const;

export const FITNESS_WEIGHTS: Readonly<Record<FounderScore, number>> = {
  [-2]: 0.1,
  [-1]: 0.35,
  [0]: 0.75,
  [1]: 1.5,
  [2]: 3,
};

export const CANONICAL_ELITE_IDS = [
  'founder-004',
  'founder-013',
  'founder-017',
  'founder-018',
  'founder-025',
  'founder-029',
  'founder-037',
] as const;

export interface GenerationConfig {
  readonly targetGeneration: number;
  readonly masterSeed: string;
  readonly counts: GenerationCounts;
  readonly fitnessWeights: Readonly<Record<FounderScore, number>>;
  readonly eliteIds: readonly string[];
  readonly maxParentUses: number;
  readonly minimumPairDistance: number;
}

export const GENERATION_1_CONFIG: GenerationConfig = {
  targetGeneration: 1,
  masterSeed: GENERATION_1_MASTER_SEED,
  counts: GENERATION_1_COUNTS,
  fitnessWeights: FITNESS_WEIGHTS,
  eliteIds: CANONICAL_ELITE_IDS,
  maxParentUses: 4,
  minimumPairDistance: 0.12,
};
