import type {
  BassGenome,
  MusicGenome,
  PercussionInstrument,
  RhythmVoiceGenome,
} from '../../genome/MusicGenome';
import { PITCH_CLASSES } from '../../genome/MusicGenome';
import { assertValidMusicGenome } from '../../genome/validateMusicGenome';
import { SeededRng } from '../../random/SeededRng';
import {
  ORGANISM_BARS,
  ORGANISM_DURATION_SECONDS,
  STEPS_PER_BAR,
  STRUDEL_COMPILER_VERSION,
  type CompiledSection,
  type CompiledStrudelEvent,
  type CompiledStrudelPattern,
  type StrudelEventControls,
} from './CompiledStrudelPattern';

interface PatternMatch {
  readonly hitIndex: number;
  readonly ghost: boolean;
}

const TOTAL_STEPS = ORGANISM_BARS * STEPS_PER_BAR;
const SECTION_B_START_STEP = 8 * STEPS_PER_BAR;

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Compiler received a non-finite numeric value: ${value}.`);
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function deterministicChance(
  seed: string,
  key: string,
  probability: number,
): boolean {
  if (probability >= 1) return true;
  if (probability <= 0) return false;
  return (
    new SeededRng(`${seed}:${STRUDEL_COMPILER_VERSION}:${key}`).next() <
    probability
  );
}

function sectionForStep(globalStep: number): CompiledSection {
  return globalStep < SECTION_B_START_STEP ? 'A' : 'B';
}

function eventLocation(
  globalStep: number,
): Pick<CompiledStrudelEvent, 'bar' | 'step' | 'section'> {
  return {
    bar: Math.floor(globalStep / STEPS_PER_BAR),
    step: globalStep % STEPS_PER_BAR,
    section: sectionForStep(globalStep),
  };
}

function soundName(genome: MusicGenome): string {
  switch (genome.sound.oscillator) {
    case 'saw':
      return 'sawtooth';
    case 'fm':
      return 'sine';
    case 'noise-blend':
      return genome.sound.noiseAmount >= 0.5 ? 'pink' : 'white';
    default:
      return genome.sound.oscillator;
  }
}

function safeCommonControls(
  genome: MusicGenome,
  section: CompiledSection,
): Omit<StrudelEventControls, 's' | 'gain' | 'velocity' | 'clip'> {
  const development = section === 'B' ? genome.development : null;
  const cutoffFactor = 1 + (development?.filterMovement ?? 0) * 0.72;
  return {
    cutoff: round(clamp(genome.sound.filterCutoff * cutoffFactor, 180, 14_000)),
    resonance: round(clamp(genome.sound.resonance, 0, 0.78)),
    drive: round(clamp(genome.sound.drive, 0, 0.82)),
    attack: round(clamp(genome.sound.envelope.attack, 0.001, 0.3)),
    decay: round(clamp(genome.sound.envelope.decay, 0.02, 1)),
    sustain: round(clamp(genome.sound.envelope.sustain, 0, 0.85)),
    release: round(clamp(genome.sound.envelope.release, 0.02, 1)),
    room: round(clamp(genome.sound.reverbAmount * 0.58, 0, 0.5)),
    delay: round(clamp(genome.sound.delayAmount * 0.42, 0, 0.3)),
    delayfeedback: round(
      clamp(0.16 + genome.sound.delayAmount * 0.24, 0.12, 0.35),
    ),
    distort: round(clamp(genome.sound.drive * 0.65, 0, 0.55)),
    fmi:
      genome.sound.oscillator === 'fm'
        ? round(clamp(0.35 + genome.sound.drive * 1.2, 0.35, 1.5))
        : undefined,
    compressor: -12,
    compressorRatio: 12,
    compressorKnee: 4,
    compressorAttack: 0.003,
    compressorRelease: 0.08,
    postgain: 0.72,
    orbit: 0,
    cps: 0.5,
  };
}

function developmentProbability(
  genome: MusicGenome,
  section: CompiledSection,
): number {
  if (section === 'A') return 0;
  return (
    genome.development.probabilityDelta + genome.development.densityDelta * 0.35
  );
}

function patternMatch(
  genome: MusicGenome,
  voice: string,
  globalStep: number,
  pattern: Pick<
    RhythmVoiceGenome,
    'steps' | 'hits' | 'probability' | 'rotation'
  >,
  rotationDelta: number,
  allowGhosts: boolean,
): PatternMatch | null {
  const section = sectionForStep(globalStep);
  const position = modulo(
    globalStep + pattern.rotation + rotationDelta,
    pattern.steps,
  );
  const hitIndex = pattern.hits.indexOf(position);
  const probability = clamp(
    pattern.probability + developmentProbability(genome, section),
    0.08,
    1,
  );

  if (hitIndex >= 0) {
    return deterministicChance(
      genome.seed,
      `${voice}:${globalStep}:hit`,
      probability,
    )
      ? { hitIndex, ghost: false }
      : null;
  }

  const ghostProbability =
    allowGhosts && section === 'B' && genome.development.densityDelta > 0
      ? clamp(genome.development.densityDelta * 0.22, 0, 0.1)
      : 0;
  return deterministicChance(
    genome.seed,
    `${voice}:${globalStep}:ghost`,
    ghostProbability,
  )
    ? { hitIndex: 0, ghost: true }
    : null;
}

function sectionGain(genome: MusicGenome, section: CompiledSection): number {
  return section === 'B'
    ? clamp(1 + genome.development.energyDelta * 0.38, 0.72, 1.22)
    : 1;
}

function compileKick(): CompiledStrudelEvent[] {
  const events: CompiledStrudelEvent[] = [];
  for (let bar = 0; bar < ORGANISM_BARS; bar += 1) {
    for (const step of [0, 4, 8, 12]) {
      events.push({
        bar,
        step,
        section: bar < 8 ? 'A' : 'B',
        voice: 'kick',
        controls: {
          s: 'sbd',
          note: 34,
          gain: 0.3,
          velocity: 0.92,
          clip: 0.7,
          decay: 0.24,
          drive: 0.12,
          compressor: -12,
          compressorRatio: 12,
          compressorKnee: 4,
          compressorAttack: 0.003,
          compressorRelease: 0.08,
          postgain: 0.72,
          orbit: 0,
          cps: 0.5,
        },
      });
    }
  }
  return events;
}

function bassMatch(
  genome: MusicGenome,
  globalStep: number,
  bass: BassGenome,
): PatternMatch | null {
  const section = sectionForStep(globalStep);
  const rotationDelta =
    section === 'B' && genome.development.bassVariation
      ? genome.development.rotationDelta
      : 0;
  return patternMatch(genome, 'bass', globalStep, bass, rotationDelta, true);
}

function compileBass(genome: MusicGenome): CompiledStrudelEvent[] {
  const events: CompiledStrudelEvent[] = [];
  const root = PITCH_CLASSES.indexOf(genome.bass.root);

  for (let globalStep = 0; globalStep < TOTAL_STEPS; globalStep += 1) {
    const match = bassMatch(genome, globalStep, genome.bass);
    if (!match) continue;

    const section = sectionForStep(globalStep);
    const pitchChoice = match.ghost
      ? new SeededRng(`${genome.seed}:bass-note:${globalStep}`).int(
          0,
          genome.bass.pitchSet.length - 1,
        )
      : genome.bass.noteChoice[match.hitIndex];
    const variedChoice =
      section === 'B' && genome.development.bassVariation
        ? modulo(pitchChoice + 1, genome.bass.pitchSet.length)
        : pitchChoice;
    const sectionShift =
      section === 'B' ? (genome.harmony.sectionBPitchShift ?? 0) : 0;
    const note = clamp(
      (genome.bass.octave + 1) * 12 +
        root +
        genome.bass.pitchSet[variedChoice] +
        sectionShift,
      24,
      72,
    );
    const accent = match.ghost ? 0.42 : genome.bass.accents[match.hitIndex];
    const noteLength = match.ghost
      ? 0.3
      : genome.bass.noteLengths[match.hitIndex];
    let gain = 0.23 * (0.62 + accent * 0.38) * sectionGain(genome, section);
    if (genome.interaction.kickBassAvoidance && globalStep % 4 === 0)
      gain *= 0.72;

    events.push({
      ...eventLocation(globalStep),
      voice: 'bass',
      controls: {
        ...safeCommonControls(genome, section),
        s: soundName(genome),
        note: round(note),
        gain: round(clamp(gain, 0.06, 0.3)),
        velocity: round(clamp(accent, 0.35, 1)),
        clip: round(clamp(genome.bass.gate * noteLength * 1.6, 0.18, 2)),
      },
    });
  }

  return events;
}

function compileRhythmVoice(
  genome: MusicGenome,
  voice: 'closed-hat' | 'open-hat',
  pattern: RhythmVoiceGenome,
): CompiledStrudelEvent[] {
  const events: CompiledStrudelEvent[] = [];
  for (let globalStep = 0; globalStep < TOTAL_STEPS; globalStep += 1) {
    const section = sectionForStep(globalStep);
    const bar = Math.floor(globalStep / STEPS_PER_BAR);
    if (pattern.muteBars.includes(bar)) continue;

    const rotationDelta =
      section === 'B' && genome.development.hatVariation
        ? genome.development.rotationDelta
        : 0;
    const match = patternMatch(
      genome,
      voice,
      globalStep,
      pattern,
      rotationDelta,
      true,
    );
    if (!match) continue;

    const accent = match.ghost ? 0.38 : pattern.accents[match.hitIndex];
    const isOpen = voice === 'open-hat';
    const common = safeCommonControls(genome, section);
    events.push({
      ...eventLocation(globalStep),
      voice,
      controls: {
        ...common,
        s:
          genome.sound.noiseAmount >= 0.5
            ? isOpen
              ? 'pink'
              : 'white'
            : isOpen
              ? 'white'
              : 'pink',
        note: isOpen ? 91 : 103,
        gain: round(
          clamp(
            (isOpen ? 0.075 : 0.065) *
              (0.55 + accent * 0.45) *
              sectionGain(genome, section),
            0.025,
            isOpen ? 0.12 : 0.1,
          ),
        ),
        velocity: round(clamp(accent, 0.3, 1)),
        clip: isOpen ? 1.4 : 0.42,
        cutoff: round(clamp((common.cutoff ?? 8_000) * 1.18, 4_000, 14_000)),
        resonance: round(clamp(genome.sound.resonance * 0.38, 0, 0.35)),
        attack: 0.001,
        decay: isOpen ? 0.16 : 0.035,
        sustain: 0,
        release: isOpen ? 0.15 : 0.025,
        distort: round(clamp(genome.sound.drive * 0.28, 0, 0.24)),
      },
    });
  }
  return events;
}

const PERCUSSION_SOUND: Record<
  PercussionInstrument,
  {
    readonly s: string;
    readonly note: number;
    readonly clip: number;
  }
> = {
  rim: { s: 'square', note: 88, clip: 0.3 },
  clap: { s: 'white', note: 76, clip: 0.5 },
  tom: { s: 'sine', note: 45, clip: 0.9 },
  cowbell: { s: 'square', note: 79, clip: 0.56 },
  noise: { s: 'pink', note: 96, clip: 0.42 },
};

function compilePercussion(genome: MusicGenome): CompiledStrudelEvent[] {
  const events: CompiledStrudelEvent[] = [];
  const bassDensity = genome.bass.hits.length / genome.bass.steps;

  genome.percussion.layers.forEach((layer, layerIndex) => {
    for (let globalStep = 0; globalStep < TOTAL_STEPS; globalStep += 1) {
      const section = sectionForStep(globalStep);
      const bar = Math.floor(globalStep / STEPS_PER_BAR);
      if (layer.muteBars.includes(bar)) continue;
      if (
        section === 'B' &&
        genome.development.percussionChange === -1 &&
        layerIndex === genome.percussion.layers.length - 1
      ) {
        continue;
      }

      const interactionProbability =
        genome.interaction.bassPercussionCoupling * (bassDensity - 0.4) * 0.18;
      const percussionBoost =
        section === 'B' && genome.development.percussionChange === 1 ? 0.12 : 0;
      const adjustedLayer = {
        ...layer,
        probability: clamp(
          layer.probability + interactionProbability + percussionBoost,
          0.08,
          1,
        ),
      };
      const match = patternMatch(
        genome,
        `percussion-${layerIndex}`,
        globalStep,
        adjustedLayer,
        section === 'B' ? genome.development.rotationDelta : 0,
        genome.development.percussionChange === 1,
      );
      if (!match) continue;

      const accent = match.ghost ? 0.36 : layer.accents[match.hitIndex];
      const sound = PERCUSSION_SOUND[layer.instrument];
      const common = safeCommonControls(genome, section);
      events.push({
        ...eventLocation(globalStep),
        voice: `percussion-${layerIndex}`,
        controls: {
          ...common,
          s:
            layer.instrument === 'noise' && genome.sound.noiseAmount >= 0.55
              ? 'brown'
              : sound.s,
          note: sound.note,
          gain: round(
            clamp(
              0.095 * (0.55 + accent * 0.45) * sectionGain(genome, section),
              0.035,
              0.14,
            ),
          ),
          velocity: round(clamp(accent, 0.3, 1)),
          clip: sound.clip,
          attack: 0.001,
          decay: layer.instrument === 'tom' ? 0.2 : 0.06,
          sustain: 0,
          release: layer.instrument === 'tom' ? 0.16 : 0.05,
          distort: round(clamp(genome.sound.drive * 0.36, 0, 0.32)),
        },
      });
    }
  });

  return events;
}

function applyInteractions(
  genome: MusicGenome,
  events: readonly CompiledStrudelEvent[],
): CompiledStrudelEvent[] {
  const locationKey = (event: CompiledStrudelEvent) =>
    `${event.bar}:${event.step}`;
  const openHatLocations = new Set(
    events.filter((event) => event.voice === 'open-hat').map(locationKey),
  );
  const bassByLocation = new Map(
    events
      .filter((event) => event.voice === 'bass')
      .map((event) => [locationKey(event), event] as const),
  );

  return events.map((event) => {
    if (!event.voice.startsWith('percussion-')) return event;

    const key = locationKey(event);
    let gain = event.controls.gain;
    let velocity = event.controls.velocity;
    if (openHatLocations.has(key)) {
      gain *= 1 - genome.interaction.openHatPercussionDucking * 0.38;
    }
    const bass = bassByLocation.get(key);
    if (bass) {
      velocity =
        velocity * (1 - genome.interaction.accentAlignment) +
        bass.controls.velocity * genome.interaction.accentAlignment;
    }

    return {
      ...event,
      controls: {
        ...event.controls,
        gain: round(clamp(gain, 0.025, 0.14)),
        velocity: round(clamp(velocity, 0.3, 1)),
      },
    };
  });
}

export function compileGenomeToStrudel(
  genome: MusicGenome,
): CompiledStrudelPattern {
  assertValidMusicGenome(genome);

  const events = applyInteractions(genome, [
    ...compileKick(),
    ...compileBass(genome),
    ...compileRhythmVoice(genome, 'closed-hat', genome.closedHat),
    ...compileRhythmVoice(genome, 'open-hat', genome.openHat),
    ...compilePercussion(genome),
  ]).sort(
    (left, right) =>
      left.bar - right.bar ||
      left.step - right.step ||
      left.voice.localeCompare(right.voice),
  );

  const compiled: CompiledStrudelPattern = {
    compilerVersion: STRUDEL_COMPILER_VERSION,
    genomeId: genome.id,
    genomeSeed: genome.seed,
    bpm: 120,
    beatsPerBar: 4,
    bars: ORGANISM_BARS,
    stepsPerBar: STEPS_PER_BAR,
    durationSeconds: ORGANISM_DURATION_SECONDS,
    sectionBoundaryBar: 8,
    events,
  };

  const errors = validateCompiledStrudelPattern(compiled);
  if (errors.length > 0) {
    throw new Error(
      `${genome.id} failed Strudel compilation: ${errors.join(' ')}`,
    );
  }
  return compiled;
}

function containsInvalidNumber(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(containsInvalidNumber);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).some(containsInvalidNumber);
  }
  return false;
}

function sectionSignature(
  compiled: CompiledStrudelPattern,
  section: CompiledSection,
): string {
  return JSON.stringify(
    compiled.events
      .filter((event) => event.section === section)
      .map((event) => ({
        relativeBar: event.bar % 8,
        step: event.step,
        voice: event.voice,
        controls: event.controls,
      })),
  );
}

export function validateCompiledStrudelPattern(
  compiled: CompiledStrudelPattern,
): string[] {
  const errors: string[] = [];
  if (compiled.bars !== 16 || compiled.durationSeconds !== 32) {
    errors.push('preview must be exactly 16 bars / 32 seconds.');
  }
  if (compiled.sectionBoundaryBar !== 8) {
    errors.push('section B must begin at bar 9.');
  }
  if (compiled.events.length === 0)
    errors.push('compiled event plan is empty.');
  if (compiled.events.filter((event) => event.voice === 'kick').length !== 64) {
    errors.push('kick must contain exactly four events per bar.');
  }
  if (!compiled.events.some((event) => event.voice === 'bass')) {
    errors.push('compiled event plan has no bass.');
  }
  if (!compiled.events.some((event) => event.section === 'A')) {
    errors.push('compiled event plan has no section A.');
  }
  if (!compiled.events.some((event) => event.section === 'B')) {
    errors.push('compiled event plan has no section B.');
  }
  if (sectionSignature(compiled, 'A') === sectionSignature(compiled, 'B')) {
    errors.push('sections A and B are identical after compilation.');
  }
  compiled.events.forEach((event) => {
    if (
      !Number.isInteger(event.bar) ||
      event.bar < 0 ||
      event.bar >= ORGANISM_BARS ||
      !Number.isInteger(event.step) ||
      event.step < 0 ||
      event.step >= STEPS_PER_BAR
    ) {
      errors.push('event position is outside the 16-bar timeline.');
    }
    if (containsInvalidNumber(event)) {
      errors.push('event plan contains NaN or Infinity.');
    }
  });
  return [...new Set(errors)];
}

export function compiledGenomeFingerprint(
  compiled: CompiledStrudelPattern,
): string {
  return JSON.stringify(
    compiled.events
      .filter((event) => event.voice !== 'kick')
      .map((event) => [event.bar, event.step, event.voice, event.controls]),
  );
}

export function debugCompiledGenome(compiled: CompiledStrudelPattern): string {
  const byVoice = compiled.events.reduce<Record<string, number>>(
    (counts, event) => {
      counts[event.voice] = (counts[event.voice] ?? 0) + 1;
      return counts;
    },
    {},
  );
  return JSON.stringify(
    {
      compilerVersion: compiled.compilerVersion,
      genomeId: compiled.genomeId,
      durationSeconds: compiled.durationSeconds,
      sectionBoundaryBar: compiled.sectionBoundaryBar,
      eventCount: compiled.events.length,
      eventsByVoice: byVoice,
      sectionA: sectionSignature(compiled, 'A'),
      sectionB: sectionSignature(compiled, 'B'),
    },
    null,
    2,
  );
}
