import type {
  MusicGenome,
  MutationStrategyGenome,
} from '../genome/MusicGenome';
import { assertValidMusicGenome } from '../genome/validateMusicGenome';
import { SeededRng } from '../random/SeededRng';

function round(value: number): number {
  return Number(value.toFixed(6));
}

function normalize(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  const result = values.map((value) => round(value / total));
  result[result.length - 1] = round(
    1 - result.slice(0, -1).reduce((sum, value) => sum + value, 0),
  );
  return result;
}

function recombineNumber(left: number, right: number, rng: SeededRng): number {
  const leftShare = rng.float(0.25, 0.75);
  return round(left * leftShare + right * (1 - leftShare));
}

export function recombineMutationStrategy(
  left: MutationStrategyGenome,
  right: MutationStrategyGenome,
  rng: SeededRng,
): MutationStrategyGenome {
  const scale = normalize([
    recombineNumber(left.microWeight, right.microWeight, rng),
    recombineNumber(left.mesoWeight, right.mesoWeight, rng),
    recombineNumber(left.macroWeight, right.macroWeight, rng),
  ]);
  const category = normalize([
    recombineNumber(left.rhythmWeight, right.rhythmWeight, rng),
    recombineNumber(left.pitchWeight, right.pitchWeight, rng),
    recombineNumber(left.soundWeight, right.soundWeight, rng),
    recombineNumber(left.developmentWeight, right.developmentWeight, rng),
  ]);
  return {
    mutationRate: recombineNumber(left.mutationRate, right.mutationRate, rng),
    mutationStrength: recombineNumber(
      left.mutationStrength,
      right.mutationStrength,
      rng,
    ),
    microWeight: scale[0],
    mesoWeight: scale[1],
    macroWeight: scale[2],
    rhythmWeight: category[0],
    pitchWeight: category[1],
    soundWeight: category[2],
    developmentWeight: category[3],
  };
}

export function crossoverGenomes(
  left: MusicGenome,
  right: MusicGenome,
  id: string,
  seed: string,
  targetGeneration = 1,
): MusicGenome {
  if (left.id === right.id) throw new Error('Crossover requires two parents.');
  const rng = new SeededRng(seed);
  const primary = rng.bool() ? left : right;
  const secondary = primary === left ? right : left;

  const child: MusicGenome = {
    version: '0.1',
    id,
    family: rng.bool() ? left.family : right.family,
    seed,
    global: structuredClone(left.global),
    bass: structuredClone(primary.bass),
    closedHat: structuredClone(secondary.closedHat),
    openHat: structuredClone(secondary.openHat),
    percussion: structuredClone(secondary.percussion),
    harmony: structuredClone(primary.harmony),
    sound: structuredClone(primary.sound),
    development: structuredClone(secondary.development),
    interaction: structuredClone(primary.interaction),
    mutationStrategy: recombineMutationStrategy(
      left.mutationStrategy,
      right.mutationStrategy,
      rng.fork('mutation-strategy'),
    ),
    lineage: {
      parents: [left.id, right.id],
      generation: targetGeneration,
      isFounder: false,
      originType: 'crossover',
      ancestorIds: [
        ...new Set([
          ...(left.lineage.ancestorIds ?? []),
          left.id,
          ...(right.lineage.ancestorIds ?? []),
          right.id,
        ]),
      ],
      mutations: [],
    },
  };

  assertValidMusicGenome(child);
  return child;
}
