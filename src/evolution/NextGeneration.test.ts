import { describe, expect, it } from 'vitest';
import foundersJson from '../data/founders.v0.1.json';
import { compileGenomeToStrudel } from '../audio/strudel/StrudelCompiler';
import type { MusicGenome } from '../genome/MusicGenome';
import type { GenerationConfig } from './GenerationConfig';
import {
  generateNextGeneration,
  validateNextGeneration,
} from './NextGeneration';

const sourcePopulation = (foundersJson as unknown as MusicGenome[])
  .slice(0, 8)
  .map((genome, index): MusicGenome => ({
    ...structuredClone(genome),
    id: `gen4-${String(index + 1).padStart(3, '0')}`,
    lineage: {
      parents: [genome.id],
      generation: 4,
      isFounder: false,
      originType: 'elite',
      ancestorIds: [genome.id],
      sourceGenomeId: genome.id,
      mutations: [],
    },
  }));

const baseFitness = new Map(
  sourcePopulation.map((genome, index) => [
    genome.id,
    index % 3 === 0 ? 3 : 1.5,
  ]),
);

const config: GenerationConfig = {
  targetGeneration: 5,
  masterSeed: 'generic-generation-five-test',
  counts: { elite: 1, crossover: 2, mutation: 1, immigrant: 2 },
  eliteIds: ['gen4-001'],
  maxParentUses: 4,
  minimumPairDistance: 0.12,
};

describe('generic next-generation engine', () => {
  it('builds a deterministic non-canonical generation above G1', () => {
    const first = generateNextGeneration(sourcePopulation, baseFitness, config);
    const second = generateNextGeneration(
      sourcePopulation,
      baseFitness,
      config,
    );

    expect(first).toEqual(second);
    expect(first.map((genome) => genome.id)).toEqual([
      'gen5-001',
      'gen5-002',
      'gen5-003',
      'gen5-004',
      'gen5-005',
      'gen5-006',
    ]);
    expect(first.every((genome) => genome.lineage.generation === 5)).toBe(true);
    expect(validateNextGeneration(first, sourcePopulation, config)).toEqual([]);

    const sourceIds = new Set(sourcePopulation.map((genome) => genome.id));
    first
      .filter((genome) => genome.lineage.parents.length > 0)
      .forEach((genome) => {
        expect(
          genome.lineage.parents.every((parent) => sourceIds.has(parent)),
        ).toBe(true);
      });
    first.forEach((genome) => {
      expect(compileGenomeToStrudel(genome).events.length).toBeGreaterThan(0);
    });
  });
});
