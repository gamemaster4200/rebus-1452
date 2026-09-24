import type { MusicGenome } from '../genome/MusicGenome';
import { genomeFeatureVector } from '../founders/GenomeFeatures';
import { SeededRng } from '../random/SeededRng';
import type { GenerationConfig } from './GenerationConfig';

export type ParentUseCounts = Map<string, number>;

export function featureDistance(left: MusicGenome, right: MusicGenome): number {
  const leftVector = genomeFeatureVector(left);
  const rightVector = genomeFeatureVector(right);
  const squared = leftVector.reduce((total, value, index) => {
    const difference = value - rightVector[index];
    return total + difference * difference;
  }, 0);
  return Math.sqrt(squared / leftVector.length);
}

export function selectionWeight(
  genome: MusicGenome,
  baseFitness: number,
  uses: number,
  familyUses: number,
  config: GenerationConfig,
  counterpart?: MusicGenome,
): number {
  if (uses >= config.maxParentUses) return 0;
  const usageProtection = 1 / (1 + uses * 0.9);
  const familyProtection = config.useFounderFamilyPressure
    ? 1 / (1 + familyUses * 0.35)
    : 1;
  if (!counterpart) return baseFitness * usageProtection * familyProtection;

  const distance = featureDistance(genome, counterpart);
  const diversity =
    distance < config.minimumPairDistance
      ? 0.08
      : 0.55 + Math.min(distance, 0.75) * 1.8;
  const crossFamily = config.useFounderFamilyPressure
    ? genome.family !== counterpart.family
      ? 1.3
      : 0.72
    : 1;
  return (
    baseFitness * usageProtection * familyProtection * diversity * crossFamily
  );
}

function weightedPick(
  candidates: readonly MusicGenome[],
  weights: readonly number[],
  rng: SeededRng,
): MusicGenome {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0)
    throw new Error('No eligible parent remains under usage caps.');
  let cursor = rng.float(0, total);
  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return candidates[index];
  }
  return candidates[candidates.length - 1];
}

function familyUseCount(
  population: readonly MusicGenome[],
  usage: ParentUseCounts,
  family: MusicGenome['family'],
): number {
  return population.reduce(
    (total, genome) =>
      total + (genome.family === family ? (usage.get(genome.id) ?? 0) : 0),
    0,
  );
}

export function selectParent(
  population: readonly MusicGenome[],
  baseFitnessByGenomeId: ReadonlyMap<string, number>,
  usage: ParentUseCounts,
  config: GenerationConfig,
  rng: SeededRng,
  counterpart?: MusicGenome,
): MusicGenome {
  const candidates = population.filter(
    (genome) => genome.id !== counterpart?.id,
  );
  const weights = candidates.map((genome) => {
    const baseFitness = baseFitnessByGenomeId.get(genome.id);
    if (baseFitness === undefined)
      throw new Error(`Missing base fitness for ${genome.id}.`);
    return selectionWeight(
      genome,
      baseFitness,
      usage.get(genome.id) ?? 0,
      familyUseCount(population, usage, genome.family),
      config,
      counterpart,
    );
  });
  const selected = weightedPick(candidates, weights, rng);
  usage.set(selected.id, (usage.get(selected.id) ?? 0) + 1);
  return selected;
}

export function selectParentPair(
  population: readonly MusicGenome[],
  baseFitnessByGenomeId: ReadonlyMap<string, number>,
  usage: ParentUseCounts,
  config: GenerationConfig,
  rng: SeededRng,
): readonly [MusicGenome, MusicGenome] {
  const first = selectParent(
    population,
    baseFitnessByGenomeId,
    usage,
    config,
    rng.fork('first'),
  );
  const second = selectParent(
    population,
    baseFitnessByGenomeId,
    usage,
    config,
    rng.fork('second'),
    first,
  );
  return [first, second];
}

/** Stable deterministic ranking: fitness descending, then source order. */
export function selectEliteIds(
  population: readonly MusicGenome[],
  baseFitnessByGenomeId: ReadonlyMap<string, number>,
  count: number,
): string[] {
  if (!Number.isInteger(count) || count < 0 || count > population.length) {
    throw new Error('Elite count must fit inside the source population.');
  }
  return population
    .map((genome, sourceIndex) => {
      const fitness = baseFitnessByGenomeId.get(genome.id);
      if (fitness === undefined || !Number.isFinite(fitness) || fitness < 0) {
        throw new Error(`Missing or invalid base fitness for ${genome.id}.`);
      }
      return { genome, sourceIndex, fitness };
    })
    .sort(
      (left, right) =>
        right.fitness - left.fitness || left.sourceIndex - right.sourceIndex,
    )
    .slice(0, count)
    .map(({ genome }) => genome.id);
}
