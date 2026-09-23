export const STRUDEL_COMPILER_VERSION = 'strudel-compiler-v1';
export const ORGANISM_DURATION_SECONDS = 32;
export const ORGANISM_BARS = 16;
export const STEPS_PER_BAR = 16;

export type CompiledSection = 'A' | 'B';
export type CompiledVoice =
  'kick' | 'bass' | 'closed-hat' | 'open-hat' | `percussion-${number}`;

/** Safe subset of Strudel/SuperDough controls emitted by the compiler. */
export interface StrudelEventControls {
  readonly s: string;
  readonly note?: number;
  readonly gain: number;
  readonly velocity: number;
  readonly clip: number;
  readonly cutoff?: number;
  readonly resonance?: number;
  readonly drive?: number;
  readonly attack?: number;
  readonly decay?: number;
  readonly sustain?: number;
  readonly release?: number;
  readonly room?: number;
  readonly delay?: number;
  readonly delayfeedback?: number;
  readonly distort?: number;
  readonly fmi?: number;
  readonly compressor: number;
  readonly compressorRatio: number;
  readonly compressorKnee: number;
  readonly compressorAttack: number;
  readonly compressorRelease: number;
  readonly postgain: number;
  readonly orbit: number;
  readonly cps: 0.5;
}

export interface CompiledStrudelEvent {
  readonly bar: number;
  readonly step: number;
  readonly section: CompiledSection;
  readonly voice: CompiledVoice;
  readonly controls: StrudelEventControls;
}

export interface CompiledStrudelPattern {
  readonly compilerVersion: typeof STRUDEL_COMPILER_VERSION;
  readonly genomeId: string;
  readonly genomeSeed: string;
  readonly bpm: 120;
  readonly beatsPerBar: 4;
  readonly bars: typeof ORGANISM_BARS;
  readonly stepsPerBar: typeof STEPS_PER_BAR;
  readonly durationSeconds: typeof ORGANISM_DURATION_SECONDS;
  readonly sectionBoundaryBar: 8;
  readonly events: readonly CompiledStrudelEvent[];
}
