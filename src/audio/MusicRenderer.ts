import type { MusicGenome } from '../genome/MusicGenome';

/** Boundary between the project genome and any audio implementation. */
export interface MusicRenderer<CompiledPattern> {
  compile(genome: MusicGenome): CompiledPattern;
  play(pattern: CompiledPattern): Promise<void>;
  stop(): Promise<void>;
}
