export const GENERATION_1_MASTER_SEED = 'rebus-1452-generation-1-v1';
export const GENERATION_1_DATASET_VERSION = 'v0.1';
export const GENERATION_2_MASTER_SEED = 'rebus-1452-generation-2-v1';
export const GENERATION_2_DATASET_VERSION = 'v0.1';

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
  readonly eliteIds?: readonly string[];
  readonly maxParentUses: number;
  readonly minimumPairDistance: number;
  /** Founder family labels are diversity scaffolding only for G0 -> G1. */
  readonly useFounderFamilyPressure: boolean;
}

export const GENERATION_1_CONFIG: GenerationConfig = {
  targetGeneration: 1,
  masterSeed: GENERATION_1_MASTER_SEED,
  counts: GENERATION_1_COUNTS,
  eliteIds: CANONICAL_ELITE_IDS,
  maxParentUses: 4,
  minimumPairDistance: 0.12,
  useFounderFamilyPressure: true,
};

export const GENERATION_2_CONFIG: GenerationConfig = {
  targetGeneration: 2,
  masterSeed: GENERATION_2_MASTER_SEED,
  counts: GENERATION_1_COUNTS,
  maxParentUses: 4,
  minimumPairDistance: 0.12,
  useFounderFamilyPressure: false,
};
