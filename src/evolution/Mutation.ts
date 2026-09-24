import {
  OSCILLATOR_FAMILIES,
  PERCUSSION_INSTRUMENTS,
  PITCH_CLASSES,
  type MusicGenome,
  type MutationCategory,
  type MutationRecord,
  type MutationScale,
  type RhythmVoiceGenome,
} from '../genome/MusicGenome';
import { STYLE_ENVELOPE } from '../genome/StyleEnvelope';
import { assertValidMusicGenome } from '../genome/validateMusicGenome';
import { SeededRng } from '../random/SeededRng';

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

export interface MutationOptions {
  readonly forceScale?: MutationScale;
  readonly forceCategory?: MutationCategory;
  readonly operationCount?: number;
}

const MACRO_RARITY_FACTOR = 0.35;

function round(value: number): number {
  return Number(value.toFixed(6));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function pickWeighted<T>(
  values: readonly T[],
  weights: readonly number[],
  rng: SeededRng,
): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = rng.float(0, total);
  for (let index = 0; index < values.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return values[index];
  }
  return values[values.length - 1];
}

function changed(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function logMutation(
  records: MutationRecord[],
  path: string,
  mutationType: string,
  before: unknown,
  after: unknown,
  scale: MutationScale,
  category: MutationCategory,
  strength: number,
): void {
  if (!changed(before, after)) return;
  records.push({
    path,
    mutationType,
    before: structuredClone(before),
    after: structuredClone(after),
    scale,
    category,
    strength: round(strength),
  });
}

function mutateNumber(
  value: number,
  minimum: number,
  maximum: number,
  strength: number,
  rng: SeededRng,
): number {
  const span = maximum - minimum;
  const direction = rng.bool() ? 1 : -1;
  const delta = span * strength * rng.float(0.18, 0.62) * direction;
  return round(clamp(value + delta, minimum, maximum));
}

function updateVoiceDensity(voice: Mutable<RhythmVoiceGenome>): void {
  voice.hits.sort((left, right) => left - right);
  voice.density = voice.hits.length / voice.steps;
  voice.euclideanPulses = voice.mode === 'euclidean' ? voice.hits.length : null;
}

function mutateVoiceHit(
  voice: Mutable<RhythmVoiceGenome>,
  rng: SeededRng,
): void {
  const maximumHits = Math.floor(
    STYLE_ENVELOPE.rhythm.density.max * voice.steps,
  );
  const minimumHits = Math.max(
    1,
    Math.ceil(STYLE_ENVELOPE.rhythm.density.min * voice.steps),
  );
  const canRemove = voice.hits.length > minimumHits;
  const canAdd = voice.hits.length < maximumHits;
  if (canRemove && (!canAdd || rng.bool())) {
    const index = rng.int(0, voice.hits.length - 1);
    voice.hits.splice(index, 1);
    voice.accents.splice(index, 1);
  } else if (canAdd) {
    const available = Array.from(
      { length: voice.steps },
      (_, step) => step,
    ).filter((step) => !voice.hits.includes(step));
    const step = rng.pick(available);
    const insertAt = voice.hits.findIndex((hit) => hit > step);
    const index = insertAt < 0 ? voice.hits.length : insertAt;
    voice.hits.splice(index, 0, step);
    voice.accents.splice(index, 0, round(rng.float(0.45, 0.92)));
  }
  updateVoiceDensity(voice);
}

function applyMicro(
  genome: Mutable<MusicGenome>,
  category: MutationCategory,
  strength: number,
  rng: SeededRng,
  records: MutationRecord[],
): void {
  if (category === 'rhythm') {
    const target = rng.pick(['gate', 'bassProbability', 'hatAccent'] as const);
    if (target === 'gate') {
      const before = genome.bass.gate;
      genome.bass.gate = mutateNumber(
        before,
        STYLE_ENVELOPE.bass.gate.min,
        STYLE_ENVELOPE.bass.gate.max,
        strength,
        rng,
      );
      logMutation(
        records,
        'bass.gate',
        'shift',
        before,
        genome.bass.gate,
        'micro',
        category,
        strength,
      );
    } else if (target === 'bassProbability') {
      const before = genome.bass.probability;
      genome.bass.probability = mutateNumber(
        before,
        STYLE_ENVELOPE.bass.probability.min,
        STYLE_ENVELOPE.bass.probability.max,
        strength,
        rng,
      );
      logMutation(
        records,
        'bass.probability',
        'shift',
        before,
        genome.bass.probability,
        'micro',
        category,
        strength,
      );
    } else {
      const index = rng.int(0, genome.closedHat.accents.length - 1);
      const before = genome.closedHat.accents[index];
      genome.closedHat.accents[index] = mutateNumber(
        before,
        0,
        1,
        strength,
        rng,
      );
      logMutation(
        records,
        `closedHat.accents[${index}]`,
        'velocity-shift',
        before,
        genome.closedHat.accents[index],
        'micro',
        category,
        strength,
      );
    }
    return;
  }

  if (category === 'pitch') {
    if (genome.bass.pitchSet.length > 1) {
      const index = rng.int(0, genome.bass.noteChoice.length - 1);
      const before = genome.bass.noteChoice[index];
      genome.bass.noteChoice[index] =
        (before + 1 + rng.int(0, genome.bass.pitchSet.length - 2)) %
        genome.bass.pitchSet.length;
      logMutation(
        records,
        `bass.noteChoice[${index}]`,
        'note-choice-shift',
        before,
        genome.bass.noteChoice[index],
        'micro',
        category,
        strength,
      );
    } else {
      const before = genome.bass.root;
      const index = PITCH_CLASSES.indexOf(before);
      genome.bass.root = PITCH_CLASSES[(index + (rng.bool() ? 1 : 11)) % 12];
      logMutation(
        records,
        'bass.root',
        'semitone-shift',
        before,
        genome.bass.root,
        'micro',
        category,
        strength,
      );
    }
    return;
  }

  if (category === 'sound') {
    const target = rng.pick(['filterCutoff', 'attack', 'release'] as const);
    if (target === 'filterCutoff') {
      const before = genome.sound.filterCutoff;
      genome.sound.filterCutoff = mutateNumber(
        before,
        STYLE_ENVELOPE.sound.filterCutoff.min,
        STYLE_ENVELOPE.sound.filterCutoff.max,
        strength,
        rng,
      );
      logMutation(
        records,
        'sound.filterCutoff',
        'filter-shift',
        before,
        genome.sound.filterCutoff,
        'micro',
        category,
        strength,
      );
    } else {
      const before = genome.sound.envelope[target];
      const range = STYLE_ENVELOPE.sound[target];
      genome.sound.envelope[target] = mutateNumber(
        before,
        range.min,
        range.max,
        strength,
        rng,
      );
      logMutation(
        records,
        `sound.envelope.${target}`,
        'envelope-shift',
        before,
        genome.sound.envelope[target],
        'micro',
        category,
        strength,
      );
    }
    return;
  }

  const before = genome.development.energyDelta;
  genome.development.energyDelta = mutateNumber(
    before,
    STYLE_ENVELOPE.development.energyDelta.min,
    STYLE_ENVELOPE.development.energyDelta.max,
    strength,
    rng,
  );
  logMutation(
    records,
    'development.energyDelta',
    'energy-shift',
    before,
    genome.development.energyDelta,
    'micro',
    category,
    strength,
  );
}

function applyMeso(
  genome: Mutable<MusicGenome>,
  category: MutationCategory,
  strength: number,
  rng: SeededRng,
  records: MutationRecord[],
): void {
  if (category === 'rhythm') {
    const target = rng.pick([
      'voice-hit',
      'voice-hit',
      'bass-rotation',
      'percussion-instrument',
    ] as const);
    if (target === 'voice-hit') {
      const voice = rng.bool() ? genome.closedHat : genome.openHat;
      const path =
        voice === genome.closedHat ? 'closedHat.hits' : 'openHat.hits';
      const before = [...voice.hits];
      mutateVoiceHit(voice, rng);
      logMutation(
        records,
        path,
        'hit-add-remove',
        before,
        voice.hits,
        'meso',
        category,
        strength,
      );
    } else if (target === 'bass-rotation') {
      const before = genome.bass.rotation;
      genome.bass.rotation = clamp(
        before + (rng.bool() ? 1 : -1) * Math.max(1, Math.round(strength * 4)),
        STYLE_ENVELOPE.bass.rotation.min,
        STYLE_ENVELOPE.bass.rotation.max,
      );
      logMutation(
        records,
        'bass.rotation',
        'pattern-rotation',
        before,
        genome.bass.rotation,
        'meso',
        category,
        strength,
      );
    } else {
      const layerIndex = rng.int(0, genome.percussion.layers.length - 1);
      const layer = genome.percussion.layers[layerIndex];
      const before = layer.instrument;
      layer.instrument = rng.pick(
        PERCUSSION_INSTRUMENTS.filter((instrument) => instrument !== before),
      );
      logMutation(
        records,
        `percussion.layers[${layerIndex}].instrument`,
        'percussion-layer-variation',
        before,
        layer.instrument,
        'meso',
        category,
        strength,
      );
    }
    return;
  }

  if (category === 'pitch') {
    const index = rng.int(0, genome.bass.noteChoice.length - 1);
    const before = genome.bass.noteChoice[index];
    genome.bass.noteChoice[index] = rng.int(0, genome.bass.pitchSet.length - 1);
    if (
      genome.bass.noteChoice[index] === before &&
      genome.bass.pitchSet.length > 1
    ) {
      genome.bass.noteChoice[index] =
        (before + 1) % genome.bass.pitchSet.length;
    }
    logMutation(
      records,
      `bass.noteChoice[${index}]`,
      'note-choice-replace',
      before,
      genome.bass.noteChoice[index],
      'meso',
      category,
      strength,
    );
    return;
  }

  if (category === 'sound') {
    const before = genome.sound.oscillator;
    const choices = OSCILLATOR_FAMILIES.filter((value) => value !== before);
    genome.sound.oscillator = rng.pick(choices);
    logMutation(
      records,
      'sound.oscillator',
      'sound-family-shift',
      before,
      genome.sound.oscillator,
      'meso',
      category,
      strength,
    );
    return;
  }

  const target = rng.pick([
    'bassVariation',
    'hatVariation',
    'rotationDelta',
    'percussionChange',
  ] as const);
  const before = genome.development[target];
  if (target === 'bassVariation' || target === 'hatVariation') {
    genome.development[target] = !before;
  } else if (target === 'rotationDelta') {
    genome.development.rotationDelta = rng.int(
      STYLE_ENVELOPE.development.rotationDelta.min,
      STYLE_ENVELOPE.development.rotationDelta.max,
    );
  } else {
    genome.development.percussionChange = rng.pick([-1, 0, 1] as const);
    if (genome.development.percussionChange === before) {
      genome.development.percussionChange = before === 1 ? -1 : 1;
    }
  }
  logMutation(
    records,
    `development.${target}`,
    'development-variation',
    before,
    genome.development[target],
    'meso',
    category,
    strength,
  );
}

function applyMacro(
  genome: Mutable<MusicGenome>,
  category: MutationCategory,
  strength: number,
  rng: SeededRng,
  records: MutationRecord[],
): void {
  if (category === 'rhythm') {
    if (rng.bool(0.35)) {
      const before = structuredClone(genome.percussion.layers);
      if (genome.percussion.layers.length === 2) {
        genome.percussion.layers.splice(rng.int(0, 1), 1);
      } else {
        const source = structuredClone(genome.percussion.layers[0]);
        source.instrument = rng.pick(
          PERCUSSION_INSTRUMENTS.filter(
            (instrument) => instrument !== source.instrument,
          ),
        );
        const rotation = rng.int(2, Math.max(2, source.steps - 2));
        source.hits = source.hits
          .map((hit) => (hit + rotation) % source.steps)
          .sort((left, right) => left - right);
        source.rotation = clamp(
          source.rotation + (rng.bool() ? 2 : -2),
          STYLE_ENVELOPE.rhythm.rotation.min,
          STYLE_ENVELOPE.rhythm.rotation.max,
        );
        genome.percussion.layers.push(source);
      }
      logMutation(
        records,
        'percussion.layers',
        genome.percussion.layers.length > before.length
          ? 'percussion-layer-add'
          : 'percussion-layer-remove',
        before,
        genome.percussion.layers,
        'macro',
        category,
        strength,
      );
      return;
    }
    const before = {
      hits: [...genome.bass.hits],
      noteChoice: [...genome.bass.noteChoice],
      accents: [...genome.bass.accents],
      noteLengths: [...genome.bass.noteLengths],
    };
    const count = clamp(
      genome.bass.hits.length + (rng.bool() ? 2 : -2),
      1,
      genome.bass.steps - 1,
    );
    const hits = Array.from({ length: genome.bass.steps }, (_, step) => ({
      step,
      value: rng.next(),
    }))
      .sort((left, right) => right.value - left.value)
      .slice(0, count)
      .map(({ step }) => step)
      .sort((left, right) => left - right);
    genome.bass.hits = hits;
    genome.bass.noteChoice = hits.map(() =>
      rng.int(0, genome.bass.pitchSet.length - 1),
    );
    genome.bass.accents = hits.map(() => round(rng.float(0.42, 1)));
    genome.bass.noteLengths = hits.map(() => round(rng.float(0.125, 1.4)));
    const after = {
      hits: genome.bass.hits,
      noteChoice: genome.bass.noteChoice,
      accents: genome.bass.accents,
      noteLengths: genome.bass.noteLengths,
    };
    logMutation(
      records,
      'bass',
      'rhythm-rebuild',
      before,
      after,
      'macro',
      category,
      strength,
    );
    return;
  }

  if (category === 'pitch') {
    const before = [...genome.bass.pitchSet];
    const pitches = new Set(before);
    if (pitches.size < STYLE_ENVELOPE.bass.pitchSetSize.max) {
      const available = Array.from({ length: 12 }, (_, value) => value).filter(
        (value) => !pitches.has(value),
      );
      pitches.add(rng.pick(available));
    } else {
      const removable = [...pitches].filter((value) => value !== 0);
      pitches.delete(rng.pick(removable));
    }
    genome.bass.pitchSet = [...pitches].sort((left, right) => left - right);
    genome.bass.noteChoice = genome.bass.noteChoice.map(
      (choice) => choice % genome.bass.pitchSet.length,
    );
    genome.harmony.pitchCollection = [...genome.bass.pitchSet];
    logMutation(
      records,
      'bass.pitchSet',
      'pitch-set-variation',
      before,
      genome.bass.pitchSet,
      'macro',
      category,
      strength,
    );
    return;
  }

  if (category === 'sound') {
    const before = {
      oscillator: genome.sound.oscillator,
      filterCutoff: genome.sound.filterCutoff,
      resonance: genome.sound.resonance,
    };
    const current = OSCILLATOR_FAMILIES.indexOf(genome.sound.oscillator);
    genome.sound.oscillator =
      OSCILLATOR_FAMILIES[
        (current + 2 + rng.int(0, 2)) % OSCILLATOR_FAMILIES.length
      ];
    genome.sound.filterCutoff = round(
      rng.float(
        STYLE_ENVELOPE.sound.filterCutoff.min,
        STYLE_ENVELOPE.sound.filterCutoff.max,
      ),
    );
    genome.sound.resonance = round(rng.float(0, 0.9));
    const after = {
      oscillator: genome.sound.oscillator,
      filterCutoff: genome.sound.filterCutoff,
      resonance: genome.sound.resonance,
    };
    logMutation(
      records,
      'sound',
      'sound-family-rebuild',
      before,
      after,
      'macro',
      category,
      strength,
    );
    return;
  }

  const before = structuredClone(genome.development);
  const direction = rng.bool() ? 1 : -1;
  genome.development.densityDelta = round(direction * rng.float(0.16, 0.35));
  genome.development.filterMovement = round(direction * rng.float(0.3, 0.6));
  genome.development.probabilityDelta = round(direction * rng.float(0.1, 0.3));
  genome.development.rotationDelta = direction * rng.int(2, 8);
  genome.development.energyDelta = round(direction * rng.float(0.2, 0.5));
  genome.development.bassVariation = true;
  genome.development.hatVariation = true;
  genome.development.percussionChange = rng.pick([-1, 1] as const);
  logMutation(
    records,
    'development',
    'development-rebuild',
    before,
    genome.development,
    'macro',
    category,
    strength,
  );
}

export function mutateGenome(
  source: MusicGenome,
  seed: string,
  options: MutationOptions = {},
): MusicGenome {
  const genome = structuredClone(source) as unknown as Mutable<MusicGenome>;
  const rng = new SeededRng(seed);
  const strategy = genome.mutationStrategy;
  const operationCount =
    options.operationCount ??
    Math.max(
      1,
      Math.min(
        6,
        Math.round(
          1 + strategy.mutationRate * 7 + strategy.mutationStrength * 3,
        ),
      ),
    );
  const records: MutationRecord[] = [];
  const scales: readonly MutationScale[] = ['micro', 'meso', 'macro'];
  const categories: readonly MutationCategory[] = [
    'rhythm',
    'pitch',
    'sound',
    'development',
  ];

  for (let index = 0; index < operationCount; index += 1) {
    const operationRng = rng.fork(`operation-${index}`);
    const scale =
      options.forceScale ??
      pickWeighted(
        scales,
        [
          strategy.microWeight,
          strategy.mesoWeight,
          strategy.macroWeight * MACRO_RARITY_FACTOR,
        ],
        operationRng.fork('scale'),
      );
    const category =
      options.forceCategory ??
      pickWeighted(
        categories,
        [
          strategy.rhythmWeight,
          strategy.pitchWeight,
          strategy.soundWeight,
          strategy.developmentWeight,
        ],
        operationRng.fork('category'),
      );
    const strength =
      strategy.mutationStrength *
      (scale === 'micro' ? 0.35 : scale === 'meso' ? 0.7 : 1);
    if (scale === 'micro') {
      applyMicro(genome, category, strength, operationRng, records);
    } else if (scale === 'meso') {
      applyMeso(genome, category, strength, operationRng, records);
    } else {
      applyMacro(genome, category, strength, operationRng, records);
    }
  }

  if (records.length === 0) {
    applyMicro(
      genome,
      'sound',
      strategy.mutationStrength * 0.35,
      rng.fork('fallback'),
      records,
    );
  }
  genome.seed = seed;
  genome.lineage.mutations = [...(genome.lineage.mutations ?? []), ...records];
  const result = genome as unknown as MusicGenome;
  assertValidMusicGenome(result);
  return result;
}
