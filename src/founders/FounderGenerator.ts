import {
  FOUNDER_FAMILIES,
  OSCILLATOR_FAMILIES,
  PERCUSSION_INSTRUMENTS,
  PITCH_CLASSES,
  type FounderFamily,
  type MusicGenome,
  type PercussionLayerGenome,
  type RhythmVoiceGenome,
} from '../genome/MusicGenome';
import { STYLE_ENVELOPE } from '../genome/StyleEnvelope';
import { assertValidMusicGenome } from '../genome/validateMusicGenome';
import { SeededRng } from '../random/SeededRng';

export const FOUNDER_MASTER_SEED = 'rebus-1452-founders-v1';
export const FOUNDER_COUNT = 42;
export const FOUNDERS_PER_FAMILY = 6;

type Range = readonly [number, number];

interface FamilyProfile {
  readonly bassDensity: Range;
  readonly hatDensity: Range;
  readonly percussionDensity: Range;
  readonly syncopation: Range;
  readonly pitchSetSize: Range;
  readonly brightness: Range;
  readonly roughness: Range;
  readonly space: Range;
  readonly development: Range;
  readonly mutationRate: Range;
}

const FAMILY_PROFILES: Record<FounderFamily, FamilyProfile> = {
  'sparse-hypnotic': {
    bassDensity: [0.12, 0.27],
    hatDensity: [0.15, 0.4],
    percussionDensity: [0.08, 0.24],
    syncopation: [0.2, 0.48],
    pitchSetSize: [1, 3],
    brightness: [0.25, 0.55],
    roughness: [0.12, 0.35],
    space: [0.58, 0.92],
    development: [0.15, 0.38],
    mutationRate: [0.04, 0.14],
  },
  'groove-heavy': {
    bassDensity: [0.35, 0.58],
    hatDensity: [0.4, 0.68],
    percussionDensity: [0.45, 0.72],
    syncopation: [0.52, 0.86],
    pitchSetSize: [2, 4],
    brightness: [0.42, 0.72],
    roughness: [0.28, 0.56],
    space: [0.18, 0.5],
    development: [0.32, 0.62],
    mutationRate: [0.09, 0.2],
  },
  driving: {
    bassDensity: [0.3, 0.52],
    hatDensity: [0.68, 0.9],
    percussionDensity: [0.28, 0.56],
    syncopation: [0.2, 0.5],
    pitchSetSize: [1, 3],
    brightness: [0.58, 0.88],
    roughness: [0.34, 0.64],
    space: [0.08, 0.34],
    development: [0.55, 0.86],
    mutationRate: [0.1, 0.22],
  },
  'bass-led': {
    bassDensity: [0.45, 0.74],
    hatDensity: [0.25, 0.58],
    percussionDensity: [0.1, 0.34],
    syncopation: [0.45, 0.82],
    pitchSetSize: [3, 6],
    brightness: [0.28, 0.66],
    roughness: [0.25, 0.58],
    space: [0.2, 0.58],
    development: [0.38, 0.72],
    mutationRate: [0.13, 0.28],
  },
  'percussion-led': {
    bassDensity: [0.14, 0.36],
    hatDensity: [0.45, 0.76],
    percussionDensity: [0.62, 0.88],
    syncopation: [0.58, 0.9],
    pitchSetSize: [1, 3],
    brightness: [0.4, 0.78],
    roughness: [0.28, 0.68],
    space: [0.23, 0.62],
    development: [0.46, 0.82],
    mutationRate: [0.14, 0.3],
  },
  'dark-industrial': {
    bassDensity: [0.25, 0.52],
    hatDensity: [0.34, 0.68],
    percussionDensity: [0.34, 0.68],
    syncopation: [0.36, 0.72],
    pitchSetSize: [1, 4],
    brightness: [0.12, 0.46],
    roughness: [0.72, 0.98],
    space: [0.18, 0.68],
    development: [0.42, 0.78],
    mutationRate: [0.19, 0.33],
  },
  'wild-outliers': {
    bassDensity: [0.18, 0.72],
    hatDensity: [0.15, 0.9],
    percussionDensity: [0.16, 0.88],
    syncopation: [0.68, 0.96],
    pitchSetSize: [2, 7],
    brightness: [0.12, 0.94],
    roughness: [0.2, 0.96],
    space: [0.08, 0.9],
    development: [0.52, 0.96],
    mutationRate: [0.25, 0.35],
  },
};

const PITCH_COLLECTIONS: readonly (readonly number[])[] = [
  [0],
  [0, 3],
  [0, 2, 3],
  [0, 1, 3, 5],
  [0, 2, 3, 5, 7],
  [0, 1, 3, 5, 7, 10],
  [0, 1, 2, 6, 7, 10, 11],
];

function round(value: number): number {
  return Number(value.toFixed(6));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function stratified(
  range: Range,
  memberIndex: number,
  axis: number,
  rng: SeededRng,
): number {
  const slot = (memberIndex * 5 + axis * 3) % FOUNDERS_PER_FAMILY;
  const position = (slot + rng.next()) / FOUNDERS_PER_FAMILY;
  return range[0] + position * (range[1] - range[0]);
}

function makeHits(
  steps: number,
  density: number,
  syncopation: number,
  rng: SeededRng,
): number[] {
  const count = clamp(Math.round(density * steps), 1, steps - 1);
  return Array.from({ length: steps }, (_, step) => ({
    step,
    score: rng.next() + (step % 4 === 0 ? 1 - syncopation : syncopation) * 0.65,
  }))
    .sort((left, right) => right.score - left.score)
    .slice(0, count)
    .map(({ step }) => step)
    .sort((left, right) => left - right);
}

function makeAccents(hits: readonly number[], rng: SeededRng): number[] {
  return hits.map((step) =>
    round(clamp(rng.float(0.45, 0.88) + (step % 4 === 0 ? 0.12 : 0), 0, 1)),
  );
}

function makeMuteBars(maximum: number, rng: SeededRng): number[] {
  const count = rng.int(0, maximum);
  const bars = new Set<number>();
  while (bars.size < count) bars.add(rng.int(0, 15));
  return [...bars].sort((left, right) => left - right);
}

function makeRhythmVoice(
  steps: number,
  targetDensity: number,
  syncopation: number,
  rng: SeededRng,
  maxMuteBars: number,
): RhythmVoiceGenome {
  const hits = makeHits(steps, targetDensity, syncopation, rng);
  const mode = rng.bool(0.42) ? 'euclidean' : 'grid';
  return {
    mode,
    steps,
    hits,
    accents: makeAccents(hits, rng),
    density: hits.length / steps,
    probability: round(rng.float(0.68, 1)),
    rotation: rng.int(-4, 4),
    euclideanPulses: mode === 'euclidean' ? hits.length : null,
    muteBars: makeMuteBars(maxMuteBars, rng),
  };
}

function chooseSteps(family: FounderFamily, rng: SeededRng): number {
  if (family === 'sparse-hypnotic') return rng.pick([16, 24, 32]);
  if (family === 'driving') return rng.pick([8, 16]);
  if (family === 'wild-outliers') return rng.pick([12, 20, 24, 32]);
  return rng.pick(STYLE_ENVELOPE.rhythm.steps);
}

function normalizeWeights(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  const normalized = values.map((value) => round(value / total));
  normalized[normalized.length - 1] = round(
    1 - normalized.slice(0, -1).reduce((sum, value) => sum + value, 0),
  );
  return normalized;
}

export function founderSeed(
  index: number,
  masterSeed = FOUNDER_MASTER_SEED,
): string {
  return `${masterSeed}:${String(index).padStart(3, '0')}`;
}

export function generateFounder(
  index: number,
  masterSeed = FOUNDER_MASTER_SEED,
): MusicGenome {
  if (!Number.isInteger(index) || index < 1 || index > FOUNDER_COUNT) {
    throw new Error(`Founder index must be between 1 and ${FOUNDER_COUNT}.`);
  }

  const familyIndex = Math.floor((index - 1) / FOUNDERS_PER_FAMILY);
  const memberIndex = (index - 1) % FOUNDERS_PER_FAMILY;
  const family = FOUNDER_FAMILIES[familyIndex];
  const profile = FAMILY_PROFILES[family];
  const seed = founderSeed(index, masterSeed);
  const rng = new SeededRng(seed);

  const bassDensity = stratified(profile.bassDensity, memberIndex, 0, rng);
  const hatDensity = stratified(profile.hatDensity, memberIndex, 1, rng);
  const percussionDensity = stratified(
    profile.percussionDensity,
    memberIndex,
    2,
    rng,
  );
  const syncopation = stratified(profile.syncopation, memberIndex, 3, rng);
  const pitchSetSize = clamp(
    Math.round(stratified(profile.pitchSetSize, memberIndex, 4, rng)),
    1,
    7,
  );
  const brightness = stratified(profile.brightness, memberIndex, 5, rng);
  const roughness = stratified(profile.roughness, memberIndex, 6, rng);
  const space = stratified(profile.space, memberIndex, 7, rng);
  const developmentAmount = stratified(
    profile.development,
    memberIndex,
    8,
    rng,
  );
  const mutationRate = stratified(profile.mutationRate, memberIndex, 9, rng);

  const root = rng.pick(PITCH_CLASSES);
  const pitchTemplate = PITCH_COLLECTIONS[pitchSetSize - 1];
  const pitchSet = [...pitchTemplate];
  const bassSteps = chooseSteps(family, rng.fork('bass-steps'));
  const bassHits = makeHits(
    bassSteps,
    bassDensity,
    syncopation,
    rng.fork('bass-hits'),
  );

  const closedHatSteps = chooseSteps(family, rng.fork('closed-hat-steps'));
  const openHatSteps = chooseSteps(family, rng.fork('open-hat-steps'));
  const closedHat = makeRhythmVoice(
    closedHatSteps,
    hatDensity,
    syncopation * 0.75,
    rng.fork('closed-hat'),
    family === 'sparse-hypnotic' ? 3 : 1,
  );
  const openHat = makeRhythmVoice(
    openHatSteps,
    clamp(hatDensity * rng.float(0.25, 0.58), 0.05, 0.6),
    clamp(syncopation + 0.08, 0, 1),
    rng.fork('open-hat'),
    2,
  );

  const layerCount =
    family === 'percussion-led' || family === 'wild-outliers'
      ? 2
      : rng.bool(percussionDensity)
        ? 2
        : 1;
  const percussionLayers: PercussionLayerGenome[] = Array.from(
    { length: layerCount },
    (_, layerIndex) => {
      const layerRng = rng.fork(`percussion-${layerIndex}`);
      const steps = chooseSteps(family, layerRng.fork('steps'));
      const voice = makeRhythmVoice(
        steps,
        clamp(percussionDensity * (layerIndex === 0 ? 0.9 : 0.65), 0.05, 0.88),
        syncopation,
        layerRng,
        2,
      );
      return {
        ...voice,
        instrument: layerRng.pick(PERCUSSION_INSTRUMENTS),
      };
    },
  );

  const scaleWeights = normalizeWeights([
    rng.float(0.35, 0.8),
    rng.float(0.15, 0.55),
    rng.float(0.05, 0.35) + developmentAmount * 0.15,
  ]);
  const categoryWeights = normalizeWeights([
    rng.float(0.3, 0.9),
    rng.float(0.1, 0.7),
    rng.float(0.2, 0.8),
    rng.float(0.2, 0.8),
  ]);
  const direction = rng.bool(0.78) ? 1 : -1;

  const genome: MusicGenome = {
    version: '0.1',
    id: `founder-${String(index).padStart(3, '0')}`,
    founderId: index,
    family,
    seed,
    global: {
      bpm: 120,
      meter: [4, 4],
      bars: 16,
      beatsPerBar: 4,
      stepsPerBeat: 4,
      kick: 'four-on-the-floor',
      form: [8, 8],
    },
    bass: {
      root,
      pitchSet,
      octave: family === 'bass-led' ? rng.int(1, 2) : rng.int(1, 3),
      steps: bassSteps,
      hits: bassHits,
      noteChoice: bassHits.map(() => rng.int(0, pitchSet.length - 1)),
      accents: makeAccents(bassHits, rng.fork('bass-accents')),
      noteLengths: bassHits.map(() => round(rng.float(0.125, 1.25))),
      gate: round(rng.float(0.28, 0.92)),
      probability: round(rng.float(0.72, 1)),
      rotation: rng.int(-4, 4),
      periodicVariation: rng.bool(0.55)
        ? {
            everyBars: rng.pick([2, 4, 8]),
            rotation: rng.pick([-3, -2, -1, 1, 2, 3]),
          }
        : null,
    },
    closedHat,
    openHat,
    percussion: { layers: percussionLayers },
    harmony: {
      tonic: root,
      pitchCollection: pitchSet,
      sectionBPitchShift:
        pitchSet.length > 1 && rng.bool(0.38) ? rng.pick([-2, -1, 1, 2]) : null,
    },
    sound: {
      oscillator:
        family === 'dark-industrial'
          ? rng.pick(['saw', 'square', 'fm', 'noise-blend'] as const)
          : rng.pick(OSCILLATOR_FAMILIES),
      filterCutoff: round(
        STYLE_ENVELOPE.sound.filterCutoff.min +
          brightness *
            (STYLE_ENVELOPE.sound.filterCutoff.max -
              STYLE_ENVELOPE.sound.filterCutoff.min),
      ),
      resonance: round(clamp(roughness * 0.65 + rng.float(-0.08, 0.15), 0, 1)),
      drive: round(clamp(roughness * 0.9 + rng.float(-0.08, 0.08), 0, 1)),
      envelope: {
        attack: round(
          rng.float(0.001, family === 'sparse-hypnotic' ? 0.25 : 0.08),
        ),
        decay: round(rng.float(0.05, 0.85)),
        sustain: round(rng.float(0.05, 0.7)),
        release: round(
          rng.float(0.04, family === 'sparse-hypnotic' ? 1.8 : 0.8),
        ),
      },
      noiseAmount: round(clamp(roughness * rng.float(0.35, 0.85), 0, 1)),
      reverbAmount: round(clamp(space * 0.85, 0, 0.85)),
      delayAmount: round(clamp(space * rng.float(0.35, 0.75), 0, 0.75)),
    },
    development: {
      densityDelta: round(
        direction * developmentAmount * rng.float(0.12, 0.34),
      ),
      bassVariation: rng.bool(clamp(developmentAmount + 0.12, 0, 1)),
      hatVariation: rng.bool(clamp(developmentAmount + 0.05, 0, 1)),
      percussionChange: rng.bool(developmentAmount)
        ? rng.pick([-1, 1] as const)
        : 0,
      filterMovement: round(
        direction * developmentAmount * rng.float(0.2, 0.6),
      ),
      probabilityDelta: round(
        direction * developmentAmount * rng.float(0.05, 0.25),
      ),
      rotationDelta: rng.bool(developmentAmount)
        ? direction * rng.int(1, Math.max(1, Math.round(developmentAmount * 6)))
        : 0,
      energyDelta: round(direction * Math.max(0.08, developmentAmount * 0.55)),
    },
    interaction: {
      bassPercussionCoupling: round(rng.float(-0.8, 0.9)),
      openHatPercussionDucking: round(
        clamp(openHat.density * rng.float(0.3, 0.95), 0, 1),
      ),
      accentAlignment: round(rng.float(0.1, 0.92)),
      kickBassAvoidance: rng.bool(family === 'driving' ? 0.75 : 0.5),
    },
    mutationStrategy: {
      mutationRate: round(mutationRate),
      mutationStrength: round(
        clamp(0.08 + mutationRate * rng.float(1.2, 2.1), 0.05, 0.8),
      ),
      microWeight: scaleWeights[0],
      mesoWeight: scaleWeights[1],
      macroWeight: scaleWeights[2],
      rhythmWeight: categoryWeights[0],
      pitchWeight: categoryWeights[1],
      soundWeight: categoryWeights[2],
      developmentWeight: categoryWeights[3],
    },
    lineage: {
      parents: [],
      generation: 0,
      isFounder: true,
    },
  };

  assertValidMusicGenome(genome);
  return genome;
}

export function generateFounderPopulation(
  masterSeed = FOUNDER_MASTER_SEED,
): MusicGenome[] {
  return Array.from({ length: FOUNDER_COUNT }, (_, index) =>
    generateFounder(index + 1, masterSeed),
  );
}
