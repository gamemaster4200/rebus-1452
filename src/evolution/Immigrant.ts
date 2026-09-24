import type {
  MusicGenome,
  PercussionLayerGenome,
  RhythmVoiceGenome,
} from '../genome/MusicGenome';
import type { NumberRange, StyleEnvelope } from '../genome/StyleEnvelope';
import { assertValidMusicGenome } from '../genome/validateMusicGenome';
import { SeededRng } from '../random/SeededRng';

export type ImmigrantGenomeTemplate = Omit<
  MusicGenome,
  'id' | 'lineage' | 'founderId' | 'family'
> & {
  readonly family?: undefined;
};

export interface ImmigrantStratum {
  readonly index: number;
  readonly total: number;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function coordinate(
  range: NumberRange,
  stratum: ImmigrantStratum,
  axis: number,
  rng: SeededRng,
): number {
  const slot = (stratum.index + axis * 3) % stratum.total;
  const position = (slot + rng.next()) / stratum.total;
  return range.min + position * (range.max - range.min);
}

function choose<T>(
  values: readonly T[],
  stratum: ImmigrantStratum,
  axis: number,
  rng: SeededRng,
): T {
  const offset =
    (stratum.index + axis * 3 + rng.int(0, values.length - 1)) % values.length;
  return values[offset];
}

function makeHits(
  steps: number,
  density: number,
  syncopation: number,
  rng: SeededRng,
): number[] {
  const count = clamp(
    Math.round(density * steps),
    Math.max(1, Math.ceil(0.03 * steps)),
    Math.min(steps - 1, Math.floor(0.9 * steps)),
  );
  return Array.from({ length: steps }, (_, step) => ({
    step,
    score: rng.next() + (step % 4 === 0 ? 1 - syncopation : syncopation) * 0.55,
  }))
    .sort((left, right) => right.score - left.score)
    .slice(0, count)
    .map(({ step }) => step)
    .sort((left, right) => left - right);
}

function makeAccents(hits: readonly number[], rng: SeededRng): number[] {
  return hits.map((step) =>
    round(clamp(rng.float(0.4, 0.92) + (step % 4 === 0 ? 0.08 : 0), 0, 1)),
  );
}

function makeMuteBars(maximum: number, rng: SeededRng): number[] {
  const count = rng.int(0, Math.min(maximum, 3));
  const bars = new Set<number>();
  while (bars.size < count) bars.add(rng.int(0, 15));
  return [...bars].sort((left, right) => left - right);
}

function makeRhythmVoice(
  styleEnvelope: StyleEnvelope,
  steps: number,
  density: number,
  syncopation: number,
  rng: SeededRng,
): RhythmVoiceGenome {
  const hits = makeHits(steps, density, syncopation, rng.fork('hits'));
  const mode = rng.bool() ? 'euclidean' : 'grid';
  return {
    mode,
    steps,
    hits,
    accents: makeAccents(hits, rng.fork('accents')),
    density: hits.length / steps,
    probability: round(
      rng.float(
        styleEnvelope.rhythm.probability.min,
        styleEnvelope.rhythm.probability.max,
      ),
    ),
    rotation: rng.int(
      styleEnvelope.rhythm.rotation.min,
      styleEnvelope.rhythm.rotation.max,
    ),
    euclideanPulses: mode === 'euclidean' ? hits.length : null,
    muteBars: makeMuteBars(
      styleEnvelope.rhythm.maxMuteBars,
      rng.fork('mute-bars'),
    ),
  };
}

function normalizeWeights(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  const normalized = values.map((value) => round(value / total));
  normalized[normalized.length - 1] = round(
    1 - normalized.slice(0, -1).reduce((sum, value) => sum + value, 0),
  );
  return normalized;
}

/** Generates identity-free musical material directly from the Style Envelope. */
export function generateImmigrant(
  styleEnvelope: StyleEnvelope,
  seed: string,
  stratum: ImmigrantStratum = { index: 0, total: 1 },
): ImmigrantGenomeTemplate {
  if (
    !Number.isInteger(stratum.index) ||
    !Number.isInteger(stratum.total) ||
    stratum.total < 1 ||
    stratum.index < 0 ||
    stratum.index >= stratum.total
  ) {
    throw new Error(
      'Immigrant stratum must be an index inside a positive total.',
    );
  }

  const rng = new SeededRng(seed);
  const density = coordinate(
    styleEnvelope.rhythm.density,
    stratum,
    0,
    rng.fork('density'),
  );
  const hatDensity = coordinate(
    styleEnvelope.rhythm.density,
    stratum,
    1,
    rng.fork('hat-density'),
  );
  const percussionDensity = coordinate(
    styleEnvelope.rhythm.density,
    stratum,
    2,
    rng.fork('percussion-density'),
  );
  const syncopation = coordinate(
    { min: 0.08, max: 0.95 },
    stratum,
    3,
    rng.fork('syncopation'),
  );
  const pitchSetSize = clamp(
    Math.round(
      coordinate(
        styleEnvelope.bass.pitchSetSize,
        stratum,
        4,
        rng.fork('pitch-set-size'),
      ),
    ),
    styleEnvelope.bass.pitchSetSize.min,
    styleEnvelope.bass.pitchSetSize.max,
  );
  const availablePitches = Array.from({ length: 11 }, (_, index) => index + 1)
    .map((pitch) => ({ pitch, order: rng.fork(`pitch-${pitch}`).next() }))
    .sort((left, right) => left.order - right.order)
    .slice(0, pitchSetSize - 1)
    .map(({ pitch }) => pitch);
  const pitchSet = [0, ...availablePitches].sort((left, right) => left - right);
  const root = choose(
    styleEnvelope.harmony.pitchClasses,
    stratum,
    5,
    rng.fork('root'),
  );
  const bassSteps = choose(
    styleEnvelope.bass.steps,
    stratum,
    6,
    rng.fork('bass-steps'),
  );
  const bassHits = makeHits(
    bassSteps,
    density,
    syncopation,
    rng.fork('bass-hits'),
  );

  const closedHatSteps = choose(
    styleEnvelope.rhythm.steps,
    stratum,
    7,
    rng.fork('closed-hat-steps'),
  );
  const openHatSteps = choose(
    styleEnvelope.rhythm.steps,
    stratum,
    8,
    rng.fork('open-hat-steps'),
  );
  const closedHat = makeRhythmVoice(
    styleEnvelope,
    closedHatSteps,
    hatDensity,
    syncopation,
    rng.fork('closed-hat'),
  );
  const openHat = makeRhythmVoice(
    styleEnvelope,
    openHatSteps,
    clamp(hatDensity * rng.float(0.25, 0.7), 0.05, 0.72),
    clamp(syncopation + 0.1, 0, 1),
    rng.fork('open-hat'),
  );

  const layerCount =
    coordinate(
      styleEnvelope.percussion.layerCount,
      stratum,
      9,
      rng.fork('layer-count'),
    ) >= 1.5
      ? 2
      : 1;
  const percussionLayers: PercussionLayerGenome[] = Array.from(
    { length: layerCount },
    (_, layerIndex) => {
      const layerRng = rng.fork(`percussion-${layerIndex}`);
      const steps = choose(
        styleEnvelope.rhythm.steps,
        stratum,
        10 + layerIndex,
        layerRng.fork('steps'),
      );
      return {
        ...makeRhythmVoice(
          styleEnvelope,
          steps,
          clamp(
            percussionDensity * (layerIndex === 0 ? 0.9 : 0.62),
            0.05,
            0.88,
          ),
          syncopation,
          layerRng,
        ),
        instrument: choose(
          styleEnvelope.percussion.instruments,
          stratum,
          12 + layerIndex,
          layerRng.fork('instrument'),
        ),
      };
    },
  );

  const scaleWeights = normalizeWeights([
    rng.float(0.3, 0.85),
    rng.float(0.15, 0.6),
    rng.float(0.03, 0.28),
  ]);
  const categoryWeights = normalizeWeights([
    rng.float(0.2, 0.9),
    rng.float(0.15, 0.8),
    rng.float(0.2, 0.9),
    rng.float(0.2, 0.9),
  ]);
  const direction = stratum.index % 2 === 0 ? 1 : -1;

  const template: ImmigrantGenomeTemplate = {
    version: '0.1',
    seed,
    global: {
      bpm: styleEnvelope.bpm,
      meter: styleEnvelope.meter,
      bars: styleEnvelope.bars,
      beatsPerBar: 4,
      stepsPerBeat: 4,
      kick: styleEnvelope.kick,
      form: styleEnvelope.form,
    },
    bass: {
      root,
      pitchSet,
      octave: Math.round(
        coordinate(styleEnvelope.bass.octave, stratum, 14, rng.fork('octave')),
      ),
      steps: bassSteps,
      hits: bassHits,
      noteChoice: bassHits.map(() => rng.int(0, pitchSet.length - 1)),
      accents: makeAccents(bassHits, rng.fork('bass-accents')),
      noteLengths: bassHits.map(() => round(rng.float(0.125, 1.65))),
      gate: round(
        coordinate(styleEnvelope.bass.gate, stratum, 15, rng.fork('gate')),
      ),
      probability: round(
        coordinate(
          styleEnvelope.bass.probability,
          stratum,
          16,
          rng.fork('bass-probability'),
        ),
      ),
      rotation: rng.int(
        styleEnvelope.bass.rotation.min,
        styleEnvelope.bass.rotation.max,
      ),
      periodicVariation: rng.bool()
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
        pitchSet.length > 1 && rng.bool() ? rng.pick([-2, -1, 1, 2]) : null,
    },
    sound: {
      oscillator: choose(
        styleEnvelope.sound.oscillators,
        stratum,
        17,
        rng.fork('oscillator'),
      ),
      filterCutoff: round(
        coordinate(
          styleEnvelope.sound.filterCutoff,
          stratum,
          18,
          rng.fork('filter-cutoff'),
        ),
      ),
      resonance: round(
        coordinate(
          styleEnvelope.sound.resonance,
          stratum,
          19,
          rng.fork('resonance'),
        ),
      ),
      drive: round(
        coordinate(styleEnvelope.sound.drive, stratum, 20, rng.fork('drive')),
      ),
      envelope: {
        attack: round(
          rng.float(
            styleEnvelope.sound.attack.min,
            styleEnvelope.sound.attack.max,
          ),
        ),
        decay: round(
          rng.float(
            styleEnvelope.sound.decay.min,
            styleEnvelope.sound.decay.max,
          ),
        ),
        sustain: round(
          rng.float(
            styleEnvelope.sound.sustain.min,
            styleEnvelope.sound.sustain.max,
          ),
        ),
        release: round(
          rng.float(
            styleEnvelope.sound.release.min,
            styleEnvelope.sound.release.max,
          ),
        ),
      },
      noiseAmount: round(
        rng.float(
          styleEnvelope.sound.noiseAmount.min,
          styleEnvelope.sound.noiseAmount.max,
        ),
      ),
      reverbAmount: round(
        coordinate(
          styleEnvelope.sound.reverbAmount,
          stratum,
          21,
          rng.fork('reverb'),
        ),
      ),
      delayAmount: round(
        coordinate(
          styleEnvelope.sound.delayAmount,
          stratum,
          22,
          rng.fork('delay'),
        ),
      ),
    },
    development: {
      densityDelta: round(
        direction * rng.float(0.08, styleEnvelope.development.densityDelta.max),
      ),
      bassVariation: rng.bool(),
      hatVariation: rng.bool(),
      percussionChange: rng.pick([-1, 0, 1] as const),
      filterMovement: round(
        direction *
          rng.float(0.12, styleEnvelope.development.filterMovement.max),
      ),
      probabilityDelta: round(direction * rng.float(0.04, 0.24)),
      rotationDelta: direction * rng.int(1, 8),
      energyDelta: round(direction * rng.float(0.08, 0.5)),
    },
    interaction: {
      bassPercussionCoupling: round(
        coordinate(
          styleEnvelope.interaction.coupling,
          stratum,
          23,
          rng.fork('coupling'),
        ),
      ),
      openHatPercussionDucking: round(
        coordinate(
          styleEnvelope.interaction.ducking,
          stratum,
          24,
          rng.fork('ducking'),
        ),
      ),
      accentAlignment: round(
        coordinate(
          styleEnvelope.interaction.accentAlignment,
          stratum,
          25,
          rng.fork('accent-alignment'),
        ),
      ),
      kickBassAvoidance: rng.bool(),
    },
    mutationStrategy: {
      mutationRate: round(
        coordinate(
          styleEnvelope.mutation.mutationRate,
          stratum,
          26,
          rng.fork('mutation-rate'),
        ),
      ),
      mutationStrength: round(
        coordinate(
          styleEnvelope.mutation.mutationStrength,
          stratum,
          27,
          rng.fork('mutation-strength'),
        ),
      ),
      microWeight: scaleWeights[0],
      mesoWeight: scaleWeights[1],
      macroWeight: scaleWeights[2],
      rhythmWeight: categoryWeights[0],
      pitchWeight: categoryWeights[1],
      soundWeight: categoryWeights[2],
      developmentWeight: categoryWeights[3],
    },
  };

  assertValidMusicGenome({
    ...template,
    id: '<immigrant-template-validation>',
    lineage: {
      parents: [],
      generation: 0,
      isFounder: false,
      originType: 'immigrant',
      ancestorIds: [],
      mutations: [],
    },
  });
  return template;
}
