import type { MusicGenome } from '../genome/MusicGenome';
import { STYLE_ENVELOPE } from '../genome/StyleEnvelope';
import { validateMusicGenome } from '../genome/validateMusicGenome';
import { SeededRng } from '../random/SeededRng';
import { crossoverGenomes } from './Crossover';
import type { GenerationConfig, GenerationCounts } from './GenerationConfig';
import { generateImmigrant } from './Immigrant';
import { mutateGenome } from './Mutation';
import {
  selectEliteIds,
  selectParent,
  selectParentPair,
  type ParentUseCounts,
} from './Selection';

function withoutFounderIdentity(
  genome: MusicGenome,
): Omit<MusicGenome, 'founderId'> {
  const clone = structuredClone(genome) as MusicGenome & {
    founderId?: number;
  };
  delete clone.founderId;
  return clone;
}

export function generationId(generation: number, index: number): string {
  return `gen${generation}-${String(index).padStart(3, '0')}`;
}

function seedFor(
  index: number,
  kind: string,
  config: GenerationConfig,
): string {
  return `${config.masterSeed}:${generationId(config.targetGeneration, index)}:${kind}`;
}

function generationSize(counts: GenerationCounts): number {
  return counts.elite + counts.crossover + counts.mutation + counts.immigrant;
}

export function musicalFingerprint(genome: MusicGenome): string {
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

function ancestorIds(...parents: readonly MusicGenome[]): string[] {
  return [
    ...new Set(
      parents.flatMap((parent) => [
        ...(parent.lineage.ancestorIds ?? []),
        parent.id,
      ]),
    ),
  ];
}

function eliteFromSource(
  source: MusicGenome,
  index: number,
  config: GenerationConfig,
): MusicGenome {
  return {
    ...structuredClone(withoutFounderIdentity(source)),
    id: generationId(config.targetGeneration, index),
    seed: source.seed,
    lineage: {
      parents: [source.id],
      generation: config.targetGeneration,
      isFounder: false,
      originType: 'elite',
      ancestorIds: ancestorIds(source),
      sourceGenomeId: source.id,
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
    id: generationId(config.targetGeneration, index),
    seed,
    lineage: {
      parents: [parent.id],
      generation: config.targetGeneration,
      isFounder: false,
      originType: 'mutation',
      ancestorIds: ancestorIds(parent),
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
  const template = generateImmigrant(STYLE_ENVELOPE, seed, {
    index: immigrantIndex,
    total: config.counts.immigrant,
  });
  return {
    ...template,
    id: generationId(config.targetGeneration, index),
    lineage: {
      parents: [],
      generation: config.targetGeneration,
      isFounder: false,
      originType: 'immigrant',
      ancestorIds: [],
      mutations: [],
    },
  };
}

function validateInputs(
  sourcePopulation: readonly MusicGenome[],
  baseFitnessByGenomeId: ReadonlyMap<string, number>,
  config: GenerationConfig,
): void {
  if (sourcePopulation.length === 0) {
    throw new Error('Source population must not be empty.');
  }
  const sourceGeneration = sourcePopulation[0].lineage.generation;
  if (
    sourcePopulation.some(
      (genome) => genome.lineage.generation !== sourceGeneration,
    )
  ) {
    throw new Error('Source population must belong to one generation.');
  }
  if (
    !Number.isInteger(config.targetGeneration) ||
    config.targetGeneration !== sourceGeneration + 1
  ) {
    throw new Error('Target generation must immediately follow the source.');
  }
  const counts = [
    config.counts.elite,
    config.counts.crossover,
    config.counts.mutation,
    config.counts.immigrant,
  ];
  if (
    counts.some((count) => !Number.isInteger(count) || count < 0) ||
    counts.reduce((sum, count) => sum + count, 0) < 1
  ) {
    throw new Error('Generation counts must be non-negative integers.');
  }
  if (config.eliteIds && config.eliteIds.length !== config.counts.elite) {
    throw new Error('Elite IDs must match the configured elite count.');
  }

  const sourceIds = new Set(sourcePopulation.map((genome) => genome.id));
  if (
    baseFitnessByGenomeId.size !== sourcePopulation.length ||
    [...sourceIds].some((id) => {
      const fitness = baseFitnessByGenomeId.get(id);
      return fitness === undefined || !Number.isFinite(fitness) || fitness < 0;
    }) ||
    [...baseFitnessByGenomeId.keys()].some((id) => !sourceIds.has(id))
  ) {
    throw new Error(
      'Base fitness must cover the source population exactly once.',
    );
  }
  config.eliteIds?.forEach((id) => {
    if (!sourceIds.has(id)) throw new Error(`Elite ${id} is missing.`);
  });
}

function resolvedEliteIds(
  sourcePopulation: readonly MusicGenome[],
  baseFitnessByGenomeId: ReadonlyMap<string, number>,
  config: GenerationConfig,
): readonly string[] {
  return (
    config.eliteIds ??
    selectEliteIds(sourcePopulation, baseFitnessByGenomeId, config.counts.elite)
  );
}

/** Builds one deterministic generation from an arbitrary preceding population. */
export function generateNextGeneration(
  sourcePopulation: readonly MusicGenome[],
  baseFitnessByGenomeId: ReadonlyMap<string, number>,
  config: GenerationConfig,
): MusicGenome[] {
  validateInputs(sourcePopulation, baseFitnessByGenomeId, config);
  const sourceById = new Map(
    sourcePopulation.map((genome) => [genome.id, genome]),
  );
  const usage: ParentUseCounts = new Map();
  const eliteIds = resolvedEliteIds(
    sourcePopulation,
    baseFitnessByGenomeId,
    config,
  );
  const population = eliteIds.map((id, index) =>
    eliteFromSource(sourceById.get(id) as MusicGenome, index + 1, config),
  );

  for (let child = 0; child < config.counts.crossover; child += 1) {
    const index = config.counts.elite + child + 1;
    const seed = seedFor(index, 'crossover', config);
    const [left, right] = selectParentPair(
      sourcePopulation,
      baseFitnessByGenomeId,
      usage,
      config,
      new SeededRng(`${seed}:selection`),
    );
    const crossed = crossoverGenomes(
      left,
      right,
      generationId(config.targetGeneration, index),
      seed,
      config.targetGeneration,
    );
    population.push(mutateGenome(crossed, seed));
  }

  for (let child = 0; child < config.counts.mutation; child += 1) {
    const index = config.counts.elite + config.counts.crossover + child + 1;
    const seed = seedFor(index, 'mutation', config);
    const parent = selectParent(
      sourcePopulation,
      baseFitnessByGenomeId,
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

  const errors = validateNextGeneration(
    population,
    sourcePopulation,
    config,
    eliteIds,
  );
  if (errors.length > 0) {
    throw new Error(
      `Generation ${config.targetGeneration} validation failed: ${errors.join(' ')}`,
    );
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

export function validateNextGeneration(
  generation: readonly MusicGenome[],
  sourcePopulation: readonly MusicGenome[],
  config: GenerationConfig,
  eliteIds: readonly string[] = config.eliteIds ??
    generation
      .slice(0, config.counts.elite)
      .map(
        (genome) => genome.lineage.sourceGenomeId ?? genome.lineage.parents[0],
      ),
): string[] {
  const errors: string[] = [];
  const sourceById = new Map(
    sourcePopulation.map((genome) => [genome.id, genome]),
  );
  const expectedCount = generationSize(config.counts);
  if (generation.length !== expectedCount) {
    errors.push(`Generation must contain ${expectedCount} organisms.`);
  }
  (Object.keys(config.counts) as Array<keyof typeof config.counts>).forEach(
    (origin) => {
      const count = generation.filter(
        (genome) => genome.lineage.originType === origin,
      ).length;
      if (count !== config.counts[origin]) {
        errors.push(`${origin} count must be ${config.counts[origin]}.`);
      }
    },
  );

  const ids = generation.map((genome) => genome.id);
  if (new Set(ids).size !== generation.length) {
    errors.push('Generation IDs must be unique.');
  }
  ids.forEach((id, index) => {
    const expected = generationId(config.targetGeneration, index + 1);
    if (id !== expected)
      errors.push(`Expected ${expected} at position ${index + 1}.`);
  });

  generation.forEach((genome) => {
    const genomeErrors = validateMusicGenome(genome);
    if (genomeErrors.length > 0) {
      errors.push(`${genome.id} is invalid: ${genomeErrors.join(' ')}`);
    }
    if (
      genome.lineage.generation !== config.targetGeneration ||
      genome.lineage.isFounder
    ) {
      errors.push(`${genome.id} has invalid generation lineage.`);
    }
    const ancestors = genome.lineage.ancestorIds;
    const mutations = genome.lineage.mutations;
    if (!ancestors || !mutations) {
      errors.push(`${genome.id} is missing detailed lineage.`);
      return;
    }
    const origin = genome.lineage.originType;
    const expectedParents =
      origin === 'crossover' ? 2 : origin === 'immigrant' ? 0 : 1;
    if (genome.lineage.parents.length !== expectedParents) {
      errors.push(`${genome.id} has invalid parent count.`);
    }
    if (genome.lineage.parents.some((parent) => !sourceById.has(parent))) {
      errors.push(
        `${genome.id} references a parent outside the source population.`,
      );
    }
    if (
      origin !== 'immigrant' &&
      genome.lineage.parents.some((parent) => !ancestors.includes(parent))
    ) {
      errors.push(`${genome.id} omits a parent from ancestorIds.`);
    }
    if (origin === 'immigrant') {
      if (ancestors.length !== 0 || genome.family !== undefined) {
        errors.push(`${genome.id} has invalid immigrant lineage or family.`);
      }
    }
    if (origin === 'crossover') {
      const [leftId, rightId] = genome.lineage.parents;
      const left = sourceById.get(leftId);
      const right = sourceById.get(rightId);
      if (left && right && !inheritedFromBothParents(genome, left, right)) {
        errors.push(`${genome.id} does not retain blocks from both parents.`);
      }
    }
  });

  const fingerprints = generation.map(musicalFingerprint);
  if (new Set(fingerprints).size !== generation.length) {
    errors.push('Generation contains duplicate musical genomes.');
  }

  eliteIds.forEach((sourceId, index) => {
    const source = sourceById.get(sourceId);
    const elite = generation[index];
    if (
      !source ||
      musicalFingerprint(source) !== musicalFingerprint(elite) ||
      source.seed !== elite.seed
    ) {
      errors.push(
        `${generationId(config.targetGeneration, index + 1)} does not preserve elite ${sourceId}.`,
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
  if (uses.size > 0 && Math.max(...uses.values()) > config.maxParentUses) {
    errors.push('One source organism exceeds the parent-use cap.');
  }
  return [...new Set(errors)];
}
