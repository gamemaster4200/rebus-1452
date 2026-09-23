import type { MusicGenome, RhythmVoiceGenome } from './MusicGenome';
import { STYLE_ENVELOPE, type NumberRange } from './StyleEnvelope';

const EPSILON = 1e-9;

function inRange(value: number, range: NumberRange): boolean {
  return value >= range.min - EPSILON && value <= range.max + EPSILON;
}

function isUnique(values: readonly number[]): boolean {
  return new Set(values).size === values.length;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function validatePositions(
  label: string,
  values: readonly number[],
  upperBound: number,
  errors: string[],
): void {
  if (
    !isUnique(values) ||
    values.some(
      (value) => !Number.isInteger(value) || value < 0 || value >= upperBound,
    )
  ) {
    errors.push(`${label} must contain unique positions inside its cycle.`);
  }
}

function validateRhythmVoice(
  label: string,
  voice: RhythmVoiceGenome,
  errors: string[],
): void {
  if (!STYLE_ENVELOPE.rhythm.steps.includes(voice.steps)) {
    errors.push(`${label}.steps is outside the Style Envelope.`);
  }

  validatePositions(`${label}.hits`, voice.hits, voice.steps, errors);
  validatePositions(`${label}.muteBars`, voice.muteBars, 16, errors);

  if (voice.accents.length !== voice.hits.length) {
    errors.push(`${label}.accents must align with hits.`);
  }

  if (voice.accents.some((accent) => !inRange(accent, { min: 0, max: 1 }))) {
    errors.push(`${label}.accents must be normalized.`);
  }

  const computedDensity = voice.hits.length / voice.steps;
  if (
    !inRange(voice.density, STYLE_ENVELOPE.rhythm.density) ||
    Math.abs(computedDensity - voice.density) > EPSILON
  ) {
    errors.push(`${label}.density must match hits / steps.`);
  }

  if (!inRange(voice.probability, STYLE_ENVELOPE.rhythm.probability)) {
    errors.push(`${label}.probability is outside the Style Envelope.`);
  }

  if (!inRange(voice.rotation, STYLE_ENVELOPE.rhythm.rotation)) {
    errors.push(`${label}.rotation is outside the Style Envelope.`);
  }

  if (voice.muteBars.length > STYLE_ENVELOPE.rhythm.maxMuteBars) {
    errors.push(`${label} contains too many mute bars.`);
  }

  if (
    voice.mode === 'euclidean' &&
    voice.euclideanPulses !== voice.hits.length
  ) {
    errors.push(`${label}.euclideanPulses must equal its hit count.`);
  }

  if (voice.mode === 'grid' && voice.euclideanPulses !== null) {
    errors.push(`${label}.euclideanPulses must be null in grid mode.`);
  }
}

function hasAudibleDevelopment(genome: MusicGenome): boolean {
  const development = genome.development;
  return (
    Math.abs(development.densityDelta) >= 0.03 ||
    development.bassVariation ||
    development.hatVariation ||
    development.percussionChange !== 0 ||
    Math.abs(development.filterMovement) >= 0.05 ||
    Math.abs(development.probabilityDelta) >= 0.03 ||
    development.rotationDelta !== 0 ||
    Math.abs(development.energyDelta) >= 0.05
  );
}

export function validateMusicGenome(genome: MusicGenome): string[] {
  const errors: string[] = [];

  if (genome.version !== '0.1') errors.push('version must be 0.1.');
  if (!genome.seed) errors.push('seed is required.');

  const global = genome.global;
  if (
    global.bpm !== STYLE_ENVELOPE.bpm ||
    global.bars !== STYLE_ENVELOPE.bars ||
    global.beatsPerBar !== 4 ||
    global.stepsPerBeat !== 4 ||
    global.meter[0] !== 4 ||
    global.meter[1] !== 4 ||
    global.form[0] !== 8 ||
    global.form[1] !== 8 ||
    global.kick !== STYLE_ENVELOPE.kick
  ) {
    errors.push('global physics must be 120 BPM, 4/4, 16 bars, A8/B8.');
  }

  const bass = genome.bass;
  if (!STYLE_ENVELOPE.bass.steps.includes(bass.steps)) {
    errors.push('bass.steps is outside the Style Envelope.');
  }
  validatePositions('bass.hits', bass.hits, bass.steps, errors);
  if (
    !isUnique(bass.pitchSet) ||
    !inRange(bass.pitchSet.length, STYLE_ENVELOPE.bass.pitchSetSize) ||
    bass.pitchSet.some(
      (pitch) => !Number.isInteger(pitch) || pitch < 0 || pitch > 11,
    )
  ) {
    errors.push('bass.pitchSet must contain one to seven unique semitones.');
  }
  if (!inRange(bass.octave, STYLE_ENVELOPE.bass.octave)) {
    errors.push('bass.octave is outside the Style Envelope.');
  }
  if (
    bass.noteChoice.length !== bass.hits.length ||
    bass.accents.length !== bass.hits.length ||
    bass.noteLengths.length !== bass.hits.length
  ) {
    errors.push('bass per-hit arrays must align with bass.hits.');
  }
  if (
    bass.noteChoice.some(
      (choice) =>
        !Number.isInteger(choice) ||
        choice < 0 ||
        choice >= bass.pitchSet.length,
    )
  ) {
    errors.push('bass.noteChoice must index bass.pitchSet.');
  }
  if (bass.accents.some((accent) => !inRange(accent, { min: 0, max: 1 }))) {
    errors.push('bass.accents must be normalized.');
  }
  if (
    bass.noteLengths.some((length) => !inRange(length, { min: 0.125, max: 2 }))
  ) {
    errors.push('bass.noteLengths is outside the Style Envelope.');
  }
  if (!inRange(bass.gate, STYLE_ENVELOPE.bass.gate)) {
    errors.push('bass.gate is outside the Style Envelope.');
  }
  if (!inRange(bass.probability, STYLE_ENVELOPE.bass.probability)) {
    errors.push('bass.probability is outside the Style Envelope.');
  }
  if (!inRange(bass.rotation, STYLE_ENVELOPE.bass.rotation)) {
    errors.push('bass.rotation is outside the Style Envelope.');
  }

  validateRhythmVoice('closedHat', genome.closedHat, errors);
  validateRhythmVoice('openHat', genome.openHat, errors);

  if (
    !inRange(
      genome.percussion.layers.length,
      STYLE_ENVELOPE.percussion.layerCount,
    )
  ) {
    errors.push('percussion must contain one or two layers.');
  }
  genome.percussion.layers.forEach((layer, index) => {
    validateRhythmVoice(`percussion.layers[${index}]`, layer, errors);
    if (!STYLE_ENVELOPE.percussion.instruments.includes(layer.instrument)) {
      errors.push(`percussion.layers[${index}].instrument is not allowed.`);
    }
  });

  if (
    !isUnique(genome.harmony.pitchCollection) ||
    !inRange(
      genome.harmony.pitchCollection.length,
      STYLE_ENVELOPE.harmony.pitchCollectionSize,
    ) ||
    genome.harmony.pitchCollection.some(
      (pitch) => !Number.isInteger(pitch) || pitch < 0 || pitch > 11,
    )
  ) {
    errors.push('harmony.pitchCollection is invalid.');
  }
  if (
    genome.harmony.sectionBPitchShift !== null &&
    !inRange(
      genome.harmony.sectionBPitchShift,
      STYLE_ENVELOPE.harmony.sectionBPitchShift,
    )
  ) {
    errors.push('harmony.sectionBPitchShift is outside the Style Envelope.');
  }

  const sound = genome.sound;
  if (!STYLE_ENVELOPE.sound.oscillators.includes(sound.oscillator)) {
    errors.push('sound.oscillator is not allowed.');
  }
  const soundRanges: ReadonlyArray<readonly [string, number, NumberRange]> = [
    ['filterCutoff', sound.filterCutoff, STYLE_ENVELOPE.sound.filterCutoff],
    ['resonance', sound.resonance, STYLE_ENVELOPE.sound.resonance],
    ['drive', sound.drive, STYLE_ENVELOPE.sound.drive],
    ['attack', sound.envelope.attack, STYLE_ENVELOPE.sound.attack],
    ['decay', sound.envelope.decay, STYLE_ENVELOPE.sound.decay],
    ['sustain', sound.envelope.sustain, STYLE_ENVELOPE.sound.sustain],
    ['release', sound.envelope.release, STYLE_ENVELOPE.sound.release],
    ['noiseAmount', sound.noiseAmount, STYLE_ENVELOPE.sound.noiseAmount],
    ['reverbAmount', sound.reverbAmount, STYLE_ENVELOPE.sound.reverbAmount],
    ['delayAmount', sound.delayAmount, STYLE_ENVELOPE.sound.delayAmount],
  ];
  soundRanges.forEach(([label, value, range]) => {
    if (!inRange(value, range))
      errors.push(`sound.${label} is outside the Style Envelope.`);
  });

  const development = genome.development;
  const developmentRanges: ReadonlyArray<
    readonly [string, number, NumberRange]
  > = [
    [
      'densityDelta',
      development.densityDelta,
      STYLE_ENVELOPE.development.densityDelta,
    ],
    [
      'filterMovement',
      development.filterMovement,
      STYLE_ENVELOPE.development.filterMovement,
    ],
    [
      'probabilityDelta',
      development.probabilityDelta,
      STYLE_ENVELOPE.development.probabilityDelta,
    ],
    [
      'rotationDelta',
      development.rotationDelta,
      STYLE_ENVELOPE.development.rotationDelta,
    ],
    [
      'energyDelta',
      development.energyDelta,
      STYLE_ENVELOPE.development.energyDelta,
    ],
  ];
  developmentRanges.forEach(([label, value, range]) => {
    if (!inRange(value, range))
      errors.push(`development.${label} is outside the Style Envelope.`);
  });
  if (!hasAudibleDevelopment(genome)) {
    errors.push('sections A and B must differ audibly.');
  }

  const interaction = genome.interaction;
  if (
    !inRange(
      interaction.bassPercussionCoupling,
      STYLE_ENVELOPE.interaction.coupling,
    )
  ) {
    errors.push('interaction.bassPercussionCoupling is invalid.');
  }
  if (
    !inRange(
      interaction.openHatPercussionDucking,
      STYLE_ENVELOPE.interaction.ducking,
    )
  ) {
    errors.push('interaction.openHatPercussionDucking is invalid.');
  }
  if (
    !inRange(
      interaction.accentAlignment,
      STYLE_ENVELOPE.interaction.accentAlignment,
    )
  ) {
    errors.push('interaction.accentAlignment is invalid.');
  }

  const mutation = genome.mutationStrategy;
  if (!inRange(mutation.mutationRate, STYLE_ENVELOPE.mutation.mutationRate)) {
    errors.push('mutationStrategy.mutationRate is invalid.');
  }
  if (
    !inRange(
      mutation.mutationStrength,
      STYLE_ENVELOPE.mutation.mutationStrength,
    )
  ) {
    errors.push('mutationStrategy.mutationStrength is invalid.');
  }
  const scaleWeights = [
    mutation.microWeight,
    mutation.mesoWeight,
    mutation.macroWeight,
  ];
  const categoryWeights = [
    mutation.rhythmWeight,
    mutation.pitchWeight,
    mutation.soundWeight,
    mutation.developmentWeight,
  ];
  if (
    [...scaleWeights, ...categoryWeights].some(
      (weight) => !inRange(weight, STYLE_ENVELOPE.mutation.weight),
    ) ||
    Math.abs(sum(scaleWeights) - 1) > 1e-6 ||
    Math.abs(sum(categoryWeights) - 1) > 1e-6
  ) {
    errors.push('mutation weights must be normalized within each group.');
  }

  return errors;
}

export function assertValidMusicGenome(genome: MusicGenome): void {
  const errors = validateMusicGenome(genome);
  if (errors.length > 0) {
    throw new Error(`${genome.id}: ${errors.join(' ')}`);
  }
}
