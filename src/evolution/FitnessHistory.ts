import { createHash } from 'node:crypto';
import { compileGenomeToStrudel } from '../audio/strudel/StrudelCompiler';
import type { MusicGenome } from '../genome/MusicGenome';
import type { FounderScore } from '../ratings/RatingRepository';
import { FITNESS_WEIGHTS } from './GenerationConfig';
import type { PopulationRatingsDataset } from './GenerationTypes';

export const FITNESS_POLICY_VERSION = 'phenotype-fitness-history-v1';

export interface FitnessObservation {
  readonly phenotypeHash: string;
  readonly generation: number;
  readonly datasetVersion: string;
  readonly datasetSha256: string;
  readonly genomeId: string;
  readonly score: FounderScore;
  readonly ratedAt?: string;
}

export interface FitnessHistoryInput {
  readonly population: readonly MusicGenome[];
  readonly ratings: PopulationRatingsDataset;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function stableCanonicalSerialization(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function phenotypeHash(genome: MusicGenome): string {
  const phenotype = Object.fromEntries(
    Object.entries(compileGenomeToStrudel(genome)).filter(
      ([key]) => key !== 'genomeId' && key !== 'genomeSeed',
    ),
  );
  return createHash('sha256')
    .update(stableCanonicalSerialization(phenotype))
    .digest('hex')
    .toUpperCase();
}

export function fitnessWeight(score: FounderScore): number {
  return FITNESS_WEIGHTS[score];
}

export function buildFitnessHistory(
  inputs: readonly FitnessHistoryInput[],
): FitnessObservation[] {
  return inputs.flatMap(({ population, ratings }) => {
    if (
      population.some(
        (genome) => genome.lineage.generation !== ratings.generation,
      )
    ) {
      throw new Error('Ratings generation must match its population.');
    }
    const populationById = new Map(
      population.map((genome) => [genome.id, genome]),
    );
    const ratingIds = new Set(ratings.ratings.map((rating) => rating.genomeId));
    if (
      ratings.ratings.length !== population.length ||
      ratingIds.size !== population.length ||
      [...ratingIds].some((id) => !populationById.has(id))
    ) {
      throw new Error('Ratings must cover their population exactly once.');
    }
    return ratings.ratings.map((rating): FitnessObservation => {
      const genome = populationById.get(rating.genomeId) as MusicGenome;
      return {
        phenotypeHash: phenotypeHash(genome),
        generation: ratings.generation,
        datasetVersion: ratings.datasetVersion,
        datasetSha256: ratings.datasetSha256,
        genomeId: rating.genomeId,
        score: rating.score,
        ...(rating.ratedAt === undefined ? {} : { ratedAt: rating.ratedAt }),
      };
    });
  });
}

export function aggregateEffectiveFitness(
  observations: readonly FitnessObservation[],
): ReadonlyMap<string, number> {
  const totals = new Map<string, { total: number; count: number }>();
  observations.forEach((observation) => {
    const current = totals.get(observation.phenotypeHash) ?? {
      total: 0,
      count: 0,
    };
    current.total += fitnessWeight(observation.score);
    current.count += 1;
    totals.set(observation.phenotypeHash, current);
  });
  return new Map(
    [...totals].map(([hash, { total, count }]) => [hash, total / count]),
  );
}

export function fitnessMapForPopulation(
  population: readonly MusicGenome[],
  effectiveFitnessByPhenotype: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> {
  return new Map(
    population.map((genome) => {
      const hash = phenotypeHash(genome);
      const fitness = effectiveFitnessByPhenotype.get(hash);
      if (fitness === undefined) {
        throw new Error(
          `No fitness observations for phenotype ${hash} (${genome.id}).`,
        );
      }
      return [genome.id, fitness] as const;
    }),
  );
}

export function derivePopulationFitness(
  population: readonly MusicGenome[],
  historyInputs: readonly FitnessHistoryInput[],
): ReadonlyMap<string, number> {
  return fitnessMapForPopulation(
    population,
    aggregateEffectiveFitness(buildFitnessHistory(historyInputs)),
  );
}
