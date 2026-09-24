import { analyzeFounderDiversity } from '../founders/Diversity';
import { generateFounder } from '../founders/FounderGenerator';
import type { MusicGenome } from '../genome/MusicGenome';
import { validateMusicGenome } from '../genome/validateMusicGenome';
import { SeededRng } from '../random/SeededRng';
import { crossoverGenomes } from './Crossover';
import { GENERATION_1_CONFIG, type GenerationConfig } from './GenerationConfig';
import type { CanonicalRatingsDataset } from './GenerationTypes';
import { mutateGenome } from './Mutation';
import {
  featureDistance,
  ratingMap,
  selectParent,
  selectParentPair,
  type ParentUseCounts,
} from './Selection';

export interface Generation1Report {
  readonly parentUses: Readonly<Record<string, number>>;
  readonly diversity: ReturnType<typeof analyzeFounderDiversity>;
  readonly mutationScales: Readonly<Record<'micro' | 'meso' | 'macro', number>>;
  readonly mutationCategories: Readonly<
    Record<'rhythm' | 'pitch' | 'sound' | 'development', number>
  >;
}

function withoutFounderIdentity(
  genome: MusicGenome,
): Omit<MusicGenome, 'founderId'> {
  const clone = structuredClone(genome) as MusicGenome & {
    founderId?: number;
  };
  delete clone.founderId;
  return clone;
}

function generationId(index: number): string {
  return `gen1-${String(index).padStart(3, '0')}`;
}

function seedFor(
  index: number,
  kind: string,
  config: GenerationConfig,
): string {
  return `${config.masterSeed}:${generationId(index)}:${kind}`;
}

function musicalFingerprint(genome: MusicGenome): string {
  return JSON.stringify({
    global: genome.global,
    bass: genome.bass,
    closedHat: genome.closedHat,
    openHat: genome.openHat,
    percussion: genome.percussion,
    harmony: genome.harmony,
    sound: genome.sound,
    development: genome.development,
    interaction: genome.interaction,
    mutationStrategy: genome.mutationStrategy,
  });
}

function eliteFromFounder(founder: MusicGenome, index: number): MusicGenome {
  return {
    ...structuredClone(withoutFounderIdentity(founder)),
    id: generationId(index),
    seed: founder.seed,
    lineage: {
      parents: [founder.id],
      generation: 1,
      isFounder: false,
      originType: 'elite',
      ancestorIds: [founder.id],
      sourceGenomeId: founder.id,
      mutations: [],
    },
  };
}

function mutationChild(
  parent: MusicGenome,
  index: number,
  config: GenerationConfig,
): MusicGenome {
  const seed = seedFor(index, 'mutation', config);
  const base: MusicGenome = {
    ...structuredClone(withoutFounderIdentity(parent)),
    id: generationId(index),
    seed,
    lineage: {
      parents: [parent.id],
      generation: 1,
      isFounder: false,
      originType: 'mutation',
      ancestorIds: [parent.id],
      mutations: [],
    },
  };
  return mutateGenome(base, seed);
}

function immigrant(
  index: number,
  immigrantIndex: number,
  config: GenerationConfig,
): MusicGenome {
  const seed = seedFor(index, 'immigrant', config);
  const stylePositions = [1, 13, 25, 37] as const;
  const generated = generateFounder(
    stylePositions[immigrantIndex],
    `${config.masterSeed}:immigrant:${immigrantIndex + 1}`,
  );
  return {
    ...structuredClone(withoutFounderIdentity(generated)),
    id: generationId(index),
    seed,
    lineage: {
      parents: [],
      generation: 1,
      isFounder: false,
      originType: 'immigrant',
      ancestorIds: [],
      mutations: [],
    },
  };
}

function validateInputs(
  founders: readonly MusicGenome[],
  ratings: CanonicalRatingsDataset,
  config: GenerationConfig,
): void {
  if (founders.length !== 42)
    throw new Error('Generation 0 must contain 42 founders.');
  if (ratings.generation !== 0 || ratings.ratings.length !== founders.length) {
    throw new Error('Canonical G0 ratings must contain exactly 42 entries.');
  }
  const founderIds = new Set(founders.map((founder) => founder.id));
  ratings.ratings.forEach((rating) => {
    if (!founderIds.has(rating.genomeId)) {
      throw new Error(`Rating references unknown genome ${rating.genomeId}.`);
    }
  });
  config.eliteIds.forEach((id) => {
    if (!founderIds.has(id)) throw new Error(`Elite ${id} is missing.`);
  });
}

export function generateGeneration1(
  founders: readonly MusicGenome[],
  ratings: CanonicalRatingsDataset,
  config: GenerationConfig = GENERATION_1_CONFIG,
): MusicGenome[] {
  validateInputs(founders, ratings, config);
  const foundersById = new Map(
    founders.map((founder) => [founder.id, founder]),
  );
  const scores = ratingMap(ratings.ratings);
  const usage: ParentUseCounts = new Map();
  const population: MusicGenome[] = config.eliteIds.map((id, index) =>
    eliteFromFounder(foundersById.get(id) as MusicGenome, index + 1),
  );

  for (let child = 0; child < config.counts.crossover; child += 1) {
    const index = config.counts.elite + child + 1;
    const seed = seedFor(index, 'crossover', config);
    const [left, right] = selectParentPair(
      founders,
      scores,
      usage,
      config,
      new SeededRng(`${seed}:selection`),
    );
    const crossed = crossoverGenomes(left, right, generationId(index), seed);
    population.push(mutateGenome(crossed, seed));
  }

  for (let child = 0; child < config.counts.mutation; child += 1) {
    const index = config.counts.elite + config.counts.crossover + child + 1;
    const seed = seedFor(index, 'mutation', config);
    const parent = selectParent(
      founders,
      scores,
      usage,
      config,
      new SeededRng(`${seed}:selection`),
    );
    population.push(mutationChild(parent, index, config));
  }

  for (let child = 0; child < config.counts.immigrant; child += 1) {
    const index =
      config.counts.elite +
      config.counts.crossover +
      config.counts.mutation +
      child +
      1;
    population.push(immigrant(index, child, config));
  }

  const errors = validateGeneration1(population, founders, config);
  if (errors.length > 0) {
    throw new Error(`Generation 1 validation failed: ${errors.join(' ')}`);
  }
  return population;
}

function inheritedFromBothParents(
  child: MusicGenome,
  left: MusicGenome,
  right: MusicGenome,
): boolean {
  const blocks = [
    'bass',
    'closedHat',
    'openHat',
    'percussion',
    'harmony',
    'sound',
    'development',
    'interaction',
  ] as const;
  const sources = new Set<string>();
  blocks.forEach((block) => {
    const value = JSON.stringify(child[block]);
    if (value === JSON.stringify(left[block])) sources.add(left.id);
    if (value === JSON.stringify(right[block])) sources.add(right.id);
  });
  return sources.has(left.id) && sources.has(right.id);
}

export function validateGeneration1(
  generation: readonly MusicGenome[],
  founders: readonly MusicGenome[],
  config: GenerationConfig = GENERATION_1_CONFIG,
): string[] {
  const errors: string[] = [];
  const foundersById = new Map(
    founders.map((founder) => [founder.id, founder]),
  );
  if (generation.length !== 42)
    errors.push('Generation 1 must contain 42 organisms.');
  const expectedOrigins = config.counts;
  (Object.keys(expectedOrigins) as Array<keyof typeof expectedOrigins>).forEach(
    (origin) => {
      const count = generation.filter(
        (genome) => genome.lineage.originType === origin,
      ).length;
      if (count !== expectedOrigins[origin])
        errors.push(`${origin} count must be ${expectedOrigins[origin]}.`);
    },
  );

  const ids = generation.map((genome) => genome.id);
  if (new Set(ids).size !== generation.length)
    errors.push('Generation 1 IDs must be unique.');
  ids.forEach((id, index) => {
    if (id !== generationId(index + 1))
      errors.push(
        `Expected ${generationId(index + 1)} at position ${index + 1}.`,
      );
  });

  generation.forEach((genome) => {
    const genomeErrors = validateMusicGenome(genome);
    if (genomeErrors.length > 0)
      errors.push(`${genome.id} is invalid: ${genomeErrors.join(' ')}`);
    if (genome.lineage.generation !== 1 || genome.lineage.isFounder)
      errors.push(`${genome.id} has invalid generation lineage.`);
    if (!genome.lineage.ancestorIds || !genome.lineage.mutations)
      errors.push(`${genome.id} is missing detailed lineage.`);
    if (genome.lineage.originType === 'crossover') {
      const [leftId, rightId] = genome.lineage.parents;
      const left = foundersById.get(leftId);
      const right = foundersById.get(rightId);
      if (!left || !right || genome.lineage.parents.length !== 2) {
        errors.push(`${genome.id} has invalid crossover parents.`);
      } else if (!inheritedFromBothParents(genome, left, right)) {
        errors.push(`${genome.id} does not retain blocks from both parents.`);
      }
    }
  });

  const fingerprints = generation.map(musicalFingerprint);
  if (new Set(fingerprints).size !== generation.length)
    errors.push('Generation 1 contains duplicate musical genomes.');

  config.eliteIds.forEach((founderId, index) => {
    const founder = foundersById.get(founderId);
    const elite = generation[index];
    if (!founder || musicalFingerprint(founder) !== musicalFingerprint(elite)) {
      errors.push(
        `${generationId(index + 1)} does not preserve elite ${founderId}.`,
      );
    }
  });

  const uses = new Map<string, number>();
  generation
    .filter(
      (genome) =>
        genome.lineage.originType === 'crossover' ||
        genome.lineage.originType === 'mutation',
    )
    .flatMap((genome) => genome.lineage.parents)
    .forEach((id) => uses.set(id, (uses.get(id) ?? 0) + 1));
  if (Math.max(...uses.values()) > config.maxParentUses)
    errors.push('One founder exceeds the parent-use cap.');

  const diversity = analyzeFounderDiversity(generation);
  if (diversity.meanDistance < 0.16)
    errors.push('Generation 1 feature space is too concentrated.');
  if (diversity.minimumDistance < 0.015)
    errors.push('Generation 1 contains nearly identical descendants.');

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
