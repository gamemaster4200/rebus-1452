import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'prettier';
import { describe, expect, it } from 'vitest';
import {
  compileGenomeToStrudel,
  validateCompiledStrudelPattern,
} from '../audio/strudel/StrudelCompiler';
import foundersJson from '../data/founders.v0.1.json';
import generation0RatingsJson from '../data/generation-0-ratings.v1.json';
import generation1Json from '../data/generation-1.v0.1.json';
import generation1RatingsJson from '../data/generation-1-ratings.v1.json';
import generation2Json from '../data/generation-2.v0.1.json';
import generation2MetadataJson from '../data/generation-2.v0.1.meta.json';
import type { MusicGenome } from '../genome/MusicGenome';
import { GENERATION_2_CONFIG } from './GenerationConfig';
import { phenotypeHash } from './FitnessHistory';
import { fitnessHistoryProvenanceHash } from './FitnessProvenance';
import {
  generateGeneration2,
  generation2Fitness,
  validateGeneration2,
} from './Generation2';
import type {
  CanonicalRatingsDataset,
  Generation2DatasetMetadata,
} from './GenerationTypes';
import { musicalFingerprint } from './NextGeneration';
import { selectEliteIds } from './Selection';

const founders = foundersJson as unknown as MusicGenome[];
const generation0Ratings =
  generation0RatingsJson as unknown as CanonicalRatingsDataset;
const generation1 = generation1Json as unknown as MusicGenome[];
const generation1Ratings =
  generation1RatingsJson as unknown as CanonicalRatingsDataset;
const canonical = generation2Json as unknown as MusicGenome[];
const metadata = generation2MetadataJson as Generation2DatasetMetadata;

function dataFileSha256(fileName: string): string {
  return createHash('sha256')
    .update(readFileSync(resolve(process.cwd(), 'src/data', fileName), 'utf8'))
    .digest('hex')
    .toUpperCase();
}

const expectedEliteIds = [
  'gen1-021',
  'gen1-028',
  'gen1-038',
  'gen1-001',
  'gen1-002',
  'gen1-004',
  'gen1-006',
];

describe('Generation 2', () => {
  it('regenerates the exact canonical 7/24/7/4 population', () => {
    const generated = generateGeneration2(
      founders,
      generation0Ratings,
      generation1,
      generation1Ratings,
    );
    expect(generated).toEqual(canonical);
    expect(validateGeneration2(generated, generation1)).toEqual([]);
    expect(generated.map((genome) => genome.id)).toEqual(
      Array.from(
        { length: 42 },
        (_, index) => `gen2-${String(index + 1).padStart(3, '0')}`,
      ),
    );
    expect(generated.map((genome) => genome.lineage.originType)).toEqual([
      ...Array<string>(7).fill('elite'),
      ...Array<string>(24).fill('crossover'),
      ...Array<string>(7).fill('mutation'),
      ...Array<string>(4).fill('immigrant'),
    ]);
    expect(new Set(generated.map(musicalFingerprint)).size).toBe(42);
  });

  it('selects elites automatically from effective phenotype fitness', () => {
    const fitness = generation2Fitness(
      founders,
      generation0Ratings,
      generation1,
      generation1Ratings,
    );
    expect(
      selectEliteIds(generation1, fitness, GENERATION_2_CONFIG.counts.elite),
    ).toEqual(expectedEliteIds);
    expect(expectedEliteIds.map((id) => fitness.get(id))).toEqual([
      3, 3, 3, 2.25, 2.25, 2.25, 2.25,
    ]);
    expect(GENERATION_2_CONFIG.eliteIds).toBeUndefined();
  });

  it('keeps all parents in G1, full ancestry, and parent-use caps', () => {
    const sourceIds = new Set(generation1.map((genome) => genome.id));
    const uses = new Map<string, number>();
    canonical.forEach((genome) => {
      genome.lineage.parents.forEach((parent) => {
        expect(sourceIds.has(parent), `${genome.id}:${parent}`).toBe(true);
        expect(genome.lineage.ancestorIds).toContain(parent);
        if (
          genome.lineage.originType === 'crossover' ||
          genome.lineage.originType === 'mutation'
        ) {
          uses.set(parent, (uses.get(parent) ?? 0) + 1);
        }
      });
    });
    expect(Math.max(...uses.values())).toBeLessThanOrEqual(
      GENERATION_2_CONFIG.maxParentUses,
    );
    expect(
      canonical.some((genome) =>
        genome.lineage.ancestorIds?.some((id) => id.startsWith('founder-')),
      ),
    ).toBe(true);
  });

  it('preserves exact elite phenotypes and validates independent immigrants', () => {
    canonical.slice(0, 7).forEach((elite, index) => {
      const source = generation1.find(
        (genome) => genome.id === expectedEliteIds[index],
      );
      expect(source).toBeDefined();
      expect(elite.seed).toBe(source?.seed);
      expect(phenotypeHash(elite)).toBe(phenotypeHash(source as MusicGenome));
      expect(elite.lineage.mutations).toEqual([]);
    });

    const immigrants = canonical.filter(
      (genome) => genome.lineage.originType === 'immigrant',
    );
    expect(immigrants).toHaveLength(4);
    immigrants.forEach((genome) => {
      expect(genome.family).toBeUndefined();
      expect(genome.lineage.parents).toEqual([]);
      expect(genome.lineage.ancestorIds).toEqual([]);
    });
    expect(new Set(immigrants.map(phenotypeHash)).size).toBe(4);
  });

  it('compiles all 42 organisms to finite non-empty playable phenotypes', () => {
    canonical.forEach((genome) => {
      const compiled = compileGenomeToStrudel(genome);
      expect(compiled.events.length, genome.id).toBeGreaterThan(0);
      expect(validateCompiledStrudelPattern(compiled), genome.id).toEqual([]);
      expect(JSON.stringify(compiled)).not.toMatch(/NaN|Infinity/);
    });
  });

  it('records and verifies the canonical G2 dataset SHA', async () => {
    const serialized = await format(JSON.stringify(canonical), {
      parser: 'json',
    });
    const sha = createHash('sha256')
      .update(serialized)
      .digest('hex')
      .toUpperCase();
    expect(sha).toBe(metadata.datasetSha256);
    expect(metadata.generation).toBe(2);
    expect(metadata.fitnessPolicyVersion).toBe('phenotype-fitness-history-v1');
  });

  it('records complete deterministic G0+G1 fitness provenance', () => {
    expect(
      metadata.fitnessHistoryInputs.map(({ generation }) => generation),
    ).toEqual([0, 1]);
    expect(metadata.fitnessHistoryInputs).toEqual([
      {
        generation: 0,
        populationDatasetVersion: generation0Ratings.datasetVersion,
        populationDatasetSha256: dataFileSha256('founders.v0.1.json'),
        ratingsDatasetVersion: generation0Ratings.version,
        ratingsFileSha256: dataFileSha256('generation-0-ratings.v1.json'),
      },
      {
        generation: 1,
        populationDatasetVersion: generation1Ratings.datasetVersion,
        populationDatasetSha256: dataFileSha256('generation-1.v0.1.json'),
        ratingsDatasetVersion: generation1Ratings.version,
        ratingsFileSha256: dataFileSha256('generation-1-ratings.v1.json'),
      },
    ]);
    expect(metadata.fitnessHistorySha256).toBe(
      fitnessHistoryProvenanceHash(metadata.fitnessHistoryInputs),
    );
  });

  it('changes aggregate provenance when any descriptor changes', () => {
    const changed = metadata.fitnessHistoryInputs.map((input, index) =>
      index === 0
        ? {
            ...input,
            ratingsFileSha256: `${input.ratingsFileSha256}-changed`,
          }
        : input,
    );
    expect(fitnessHistoryProvenanceHash(changed)).not.toBe(
      metadata.fitnessHistorySha256,
    );
  });
});
