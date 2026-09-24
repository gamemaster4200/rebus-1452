export const FOUNDER_FAMILIES = [
  'sparse-hypnotic',
  'groove-heavy',
  'driving',
  'bass-led',
  'percussion-led',
  'dark-industrial',
  'wild-outliers',
] as const;

export type FounderFamily = (typeof FOUNDER_FAMILIES)[number];

export const PITCH_CLASSES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export type PitchClass = (typeof PITCH_CLASSES)[number];

export interface GlobalGenome {
  readonly bpm: 120;
  readonly meter: readonly [4, 4];
  readonly bars: 16;
  readonly beatsPerBar: 4;
  readonly stepsPerBeat: 4;
  readonly kick: 'four-on-the-floor';
  readonly form: readonly [8, 8];
}

export interface BassGenome {
  readonly root: PitchClass;
  readonly pitchSet: readonly number[];
  readonly octave: number;
  readonly steps: number;
  readonly hits: readonly number[];
  readonly noteChoice: readonly number[];
  readonly accents: readonly number[];
  readonly noteLengths: readonly number[];
  readonly gate: number;
  readonly probability: number;
  readonly rotation: number;
  readonly periodicVariation: {
    readonly everyBars: number;
    readonly rotation: number;
  } | null;
}

export interface RhythmVoiceGenome {
  readonly mode: 'grid' | 'euclidean';
  readonly steps: number;
  readonly hits: readonly number[];
  readonly accents: readonly number[];
  readonly density: number;
  readonly probability: number;
  readonly rotation: number;
  readonly euclideanPulses: number | null;
  readonly muteBars: readonly number[];
}

export const PERCUSSION_INSTRUMENTS = [
  'rim',
  'clap',
  'tom',
  'cowbell',
  'noise',
] as const;

export type PercussionInstrument = (typeof PERCUSSION_INSTRUMENTS)[number];

export interface PercussionLayerGenome extends RhythmVoiceGenome {
  readonly instrument: PercussionInstrument;
}

export interface PercussionGenome {
  readonly layers: readonly PercussionLayerGenome[];
}

export interface HarmonyGenome {
  readonly tonic: PitchClass;
  readonly pitchCollection: readonly number[];
  readonly sectionBPitchShift: number | null;
}

export const OSCILLATOR_FAMILIES = [
  'sine',
  'triangle',
  'saw',
  'square',
  'fm',
  'noise-blend',
] as const;

export type OscillatorFamily = (typeof OSCILLATOR_FAMILIES)[number];

export interface SoundGenome {
  readonly oscillator: OscillatorFamily;
  readonly filterCutoff: number;
  readonly resonance: number;
  readonly drive: number;
  readonly envelope: {
    readonly attack: number;
    readonly decay: number;
    readonly sustain: number;
    readonly release: number;
  };
  readonly noiseAmount: number;
  readonly reverbAmount: number;
  readonly delayAmount: number;
}

export interface DevelopmentGenome {
  readonly densityDelta: number;
  readonly bassVariation: boolean;
  readonly hatVariation: boolean;
  readonly percussionChange: -1 | 0 | 1;
  readonly filterMovement: number;
  readonly probabilityDelta: number;
  readonly rotationDelta: number;
  readonly energyDelta: number;
}

export interface InteractionGenome {
  readonly bassPercussionCoupling: number;
  readonly openHatPercussionDucking: number;
  readonly accentAlignment: number;
  readonly kickBassAvoidance: boolean;
}

export interface MutationStrategyGenome {
  readonly mutationRate: number;
  readonly mutationStrength: number;
  readonly microWeight: number;
  readonly mesoWeight: number;
  readonly macroWeight: number;
  readonly rhythmWeight: number;
  readonly pitchWeight: number;
  readonly soundWeight: number;
  readonly developmentWeight: number;
}

export interface LineageMetadata {
  readonly parents: readonly string[];
  readonly generation: number;
  readonly isFounder: boolean;
}

/** Renderer-neutral musical organism contract for the v0.1 world model. */
export interface MusicGenome {
  readonly version: '0.1';
  readonly id: string;
  readonly founderId?: number;
  readonly family?: FounderFamily;
  readonly seed: string;
  readonly global: GlobalGenome;
  readonly bass: BassGenome;
  readonly closedHat: RhythmVoiceGenome;
  readonly openHat: RhythmVoiceGenome;
  readonly percussion: PercussionGenome;
  readonly harmony: HarmonyGenome;
  readonly sound: SoundGenome;
  readonly development: DevelopmentGenome;
  readonly interaction: InteractionGenome;
  readonly mutationStrategy: MutationStrategyGenome;
  readonly lineage: LineageMetadata;
}
