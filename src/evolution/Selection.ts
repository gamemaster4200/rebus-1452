import type { MusicGenome } from '../genome/MusicGenome';
import type { FounderScore } from '../ratings/RatingRepository';
import { genomeFeatureVector } from '../founders/GenomeFeatures';
import { SeededRng } from '../random/SeededRng';
import type { GenerationConfig } from './GenerationConfig';
import type { CanonicalRatingInput } from './GenerationTypes';

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

export function ratingMap(
  ratings: readonly CanonicalRatingInput[],
): ReadonlyMap<string, FounderScore> {
  return new Map(ratings.map((rating) => [rating.genomeId, rating.score]));
}

export function selectionWeight(
  genome: MusicGenome,
  score: FounderScore,
  uses: number,
  familyUses: number,
  config: GenerationConfig,
  counterpart?: MusicGenome,
): number {
  if (uses >= config.maxParentUses) return 0;
  const fitness = config.fitnessWeights[score];
  const usageProtection = 1 / (1 + uses * 0.9);
  const familyProtection = 1 / (1 + familyUses * 0.35);
  if (!counterpart) return fitness * usageProtection * familyProtection;

  const distance = featureDistance(genome, counterpart);
  const diversity =
    distance < config.minimumPairDistance
      ? 0.08
      : 0.55 + Math.min(distance, 0.75) * 1.8;
  const crossFamily = genome.family !== counterpart.family ? 1.3 : 0.72;
  return fitness * usageProtection * familyProtection * diversity * crossFamily;
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
  scores: ReadonlyMap<string, FounderScore>,
  usage: ParentUseCounts,
  config: GenerationConfig,
  rng: SeededRng,
  counterpart?: MusicGenome,
): MusicGenome {
  const candidates = population.filter(
    (genome) => genome.id !== counterpart?.id,
  );
  const weights = candidates.map((genome) => {
    const score = scores.get(genome.id);
    if (score === undefined)
      throw new Error(`Missing rating for ${genome.id}.`);
    return selectionWeight(
      genome,
      score,
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
  scores: ReadonlyMap<string, FounderScore>,
  usage: ParentUseCounts,
  config: GenerationConfig,
  rng: SeededRng,
): readonly [MusicGenome, MusicGenome] {
  const first = selectParent(
    population,
    scores,
    usage,
    config,
    rng.fork('first'),
  );
  const second = selectParent(
    population,
    scores,
    usage,
    config,
    rng.fork('second'),
    first,
  );
  return [first, second];
}
