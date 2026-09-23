import type { MusicGenome } from '../genome/MusicGenome';

/** A future selection, crossover, or mutation operation. */
export interface EvolutionOperator {
  apply(population: readonly MusicGenome[], seed: number): MusicGenome[];
}
