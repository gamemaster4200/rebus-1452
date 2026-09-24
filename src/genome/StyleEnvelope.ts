import {
  FOUNDER_FAMILIES,
  OSCILLATOR_FAMILIES,
  PERCUSSION_INSTRUMENTS,
  PITCH_CLASSES,
} from './MusicGenome';

export interface NumberRange {
  readonly min: number;
  readonly max: number;
}

export interface StyleEnvelope {
  readonly bpm: 120;
  readonly meter: readonly [4, 4];
  readonly bars: 16;
  readonly form: readonly [8, 8];
  readonly kick: 'four-on-the-floor';
  readonly bass: {
    readonly steps: readonly number[];
    readonly pitchSetSize: NumberRange;
    readonly octave: NumberRange;
    readonly gate: NumberRange;
    readonly probability: NumberRange;
    readonly rotation: NumberRange;
  };
  readonly rhythm: {
    readonly steps: readonly number[];
    readonly density: NumberRange;
    readonly probability: NumberRange;
    readonly rotation: NumberRange;
    readonly maxMuteBars: number;
  };
  readonly percussion: {
    readonly layerCount: NumberRange;
    readonly instruments: typeof PERCUSSION_INSTRUMENTS;
  };
  readonly harmony: {
    readonly pitchCollectionSize: NumberRange;
    readonly sectionBPitchShift: NumberRange;
    readonly pitchClasses: typeof PITCH_CLASSES;
  };
  readonly sound: {
    readonly oscillators: typeof OSCILLATOR_FAMILIES;
    readonly filterCutoff: NumberRange;
    readonly resonance: NumberRange;
    readonly drive: NumberRange;
    readonly attack: NumberRange;
    readonly decay: NumberRange;
    readonly sustain: NumberRange;
    readonly release: NumberRange;
    readonly noiseAmount: NumberRange;
    readonly reverbAmount: NumberRange;
    readonly delayAmount: NumberRange;
  };
  readonly development: {
    readonly densityDelta: NumberRange;
    readonly filterMovement: NumberRange;
    readonly probabilityDelta: NumberRange;
    readonly rotationDelta: NumberRange;
    readonly energyDelta: NumberRange;
  };
  readonly interaction: {
    readonly coupling: NumberRange;
    readonly ducking: NumberRange;
    readonly accentAlignment: NumberRange;
  };
  readonly mutation: {
    readonly mutationRate: NumberRange;
    readonly mutationStrength: NumberRange;
    readonly weight: NumberRange;
  };
  readonly founderFamilies: typeof FOUNDER_FAMILIES;
  readonly invariants: readonly string[];
}

export const STYLE_ENVELOPE: StyleEnvelope = {
  bpm: 120,
  meter: [4, 4],
  bars: 16,
  form: [8, 8],
  kick: 'four-on-the-floor',
  bass: {
    steps: [8, 12, 16, 20, 24, 32],
    pitchSetSize: { min: 1, max: 7 },
    octave: { min: 1, max: 4 },
    gate: { min: 0.1, max: 1 },
    probability: { min: 0.5, max: 1 },
    rotation: { min: -8, max: 8 },
  },
  rhythm: {
    steps: [8, 12, 16, 20, 24, 32],
    density: { min: 0.03, max: 0.9 },
    probability: { min: 0.45, max: 1 },
    rotation: { min: -8, max: 8 },
    maxMuteBars: 4,
  },
  percussion: {
    layerCount: { min: 1, max: 2 },
    instruments: PERCUSSION_INSTRUMENTS,
  },
  harmony: {
    pitchCollectionSize: { min: 1, max: 7 },
    sectionBPitchShift: { min: -2, max: 2 },
    pitchClasses: PITCH_CLASSES,
  },
  sound: {
    oscillators: OSCILLATOR_FAMILIES,
    filterCutoff: { min: 250, max: 12_000 },
    resonance: { min: 0, max: 1 },
    drive: { min: 0, max: 1 },
    attack: { min: 0.001, max: 0.5 },
    decay: { min: 0.02, max: 1.5 },
    sustain: { min: 0, max: 1 },
    release: { min: 0.02, max: 2 },
    noiseAmount: { min: 0, max: 1 },
    reverbAmount: { min: 0, max: 0.85 },
    delayAmount: { min: 0, max: 0.75 },
  },
  development: {
    densityDelta: { min: -0.35, max: 0.35 },
    filterMovement: { min: -0.6, max: 0.6 },
    probabilityDelta: { min: -0.3, max: 0.3 },
    rotationDelta: { min: -8, max: 8 },
    energyDelta: { min: -0.5, max: 0.6 },
  },
  interaction: {
    coupling: { min: -1, max: 1 },
    ducking: { min: 0, max: 1 },
    accentAlignment: { min: 0, max: 1 },
  },
  mutation: {
    mutationRate: { min: 0.03, max: 0.35 },
    mutationStrength: { min: 0.05, max: 0.8 },
    weight: { min: 0, max: 1 },
  },
  founderFamilies: FOUNDER_FAMILIES,
  invariants: [
    'The kick is always four-on-the-floor.',
    'Every organism is 16 bars at 120 BPM in 4/4: exactly 32 seconds.',
    'Sections A and B are eight bars each and differ audibly.',
    'Genomes contain structured musical data, never renderer source.',
    'Pitch collections contain at most seven unique pitch values.',
    'Percussion contains one or two logical layers.',
    'All pattern positions and mute regions remain inside their cycles or fragment.',
    'Mutation scale weights sum to one.',
  ],
};
