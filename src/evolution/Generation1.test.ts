import { describe, expect, it } from 'vitest';
import foundersJson from '../data/founders.v0.1.json';
import generationJson from '../data/generation-1.v0.1.json';
import ratingsJson from '../data/generation-0-ratings.v1.json';
import type { MusicGenome } from '../genome/MusicGenome';
import {
  compileGenomeToStrudel,
  validateCompiledStrudelPattern,
} from '../audio/strudel/StrudelCompiler';
import { CANONICAL_ELITE_IDS } from './GenerationConfig';
import { generateGeneration1, validateGeneration1 } from './Generation1';
import type { CanonicalRatingsDataset } from './GenerationTypes';

const founders = foundersJson as unknown as MusicGenome[];
const ratings = ratingsJson as unknown as CanonicalRatingsDataset;
const canonical = generationJson as unknown as MusicGenome[];

function musicalFingerprint(genome: MusicGenome): unknown {
  return {
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
  };
}

function compiledPhenotype(genome: MusicGenome): unknown {
  const compiled = compileGenomeToStrudel(genome);
  return { ...compiled, genomeId: '<identity-only>' };
}

describe('Generation 1', () => {
  it('regenerates the exact canonical 42-organism population', () => {
    const generated = generateGeneration1(founders, ratings);
    expect(generated).toEqual(canonical);
    expect(validateGeneration1(generated, founders)).toEqual([]);
    expect(generated.map((genome) => genome.lineage.originType)).toEqual([
      ...Array<string>(7).fill('elite'),
      ...Array<string>(24).fill('crossover'),
      ...Array<string>(7).fill('mutation'),
      ...Array<string>(4).fill('immigrant'),
    ]);
    expect(new Set(generated.map((genome) => genome.id)).size).toBe(42);
  });

  it('preserves the complete musical phenotype of every canonical elite', () => {
    CANONICAL_ELITE_IDS.forEach((id, index) => {
      const founder = founders.find((genome) => genome.id === id);
      const elite = canonical[index];
      expect(founder).toBeDefined();
      if (!founder) throw new Error(`Missing canonical elite source ${id}.`);

      expect(elite.lineage.sourceGenomeId).toBe(id);
      expect(musicalFingerprint(elite)).toEqual(musicalFingerprint(founder));
      expect(elite.seed).toBe(founder.seed);
      expect(compiledPhenotype(elite)).toEqual(compiledPhenotype(founder));
    });
  });

  it('compiles all 42 organisms to finite non-empty playable phenotypes', () => {
    canonical.forEach((genome) => {
      const compiled = compileGenomeToStrudel(genome);
      expect(compiled.events.length, genome.id).toBeGreaterThan(0);
      expect(validateCompiledStrudelPattern(compiled), genome.id).toEqual([]);
      expect(JSON.stringify(compiled)).not.toMatch(/NaN|Infinity/);
    });
  });

  it('keeps macro mutation rare across the canonical population', () => {
    const mutations = canonical.flatMap(
      (genome) => genome.lineage.mutations ?? [],
    );
    const macroCount = mutations.filter(
      (mutation) => mutation.scale === 'macro',
    ).length;
    expect(macroCount / mutations.length).toBeLessThan(0.2);
  });
});
