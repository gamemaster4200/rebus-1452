import type { MusicGenome, RhythmVoiceGenome } from '../genome/MusicGenome';
import { STYLE_ENVELOPE, type NumberRange } from '../genome/StyleEnvelope';

export const GENOME_FEATURE_KEYS = [
  'bassDensity',
  'bassPitchVariety',
  'hatDensity',
  'percussionDensity',
  'syncopation',
  'brightness',
  'roughness',
  'space',
  'developmentAmount',
  'mutationRate',
] as const;

export type GenomeFeatureKey = (typeof GENOME_FEATURE_KEYS)[number];
export type GenomeFeatures = Readonly<Record<GenomeFeatureKey, number>>;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalize(value: number, range: NumberRange): number {
  return clamp01((value - range.min) / (range.max - range.min));
}

function rhythmDensity(voice: RhythmVoiceGenome): number {
  return voice.hits.length / voice.steps;
}

function syncopationScore(genome: MusicGenome): number {
  const patterns = [
    { hits: genome.bass.hits, steps: genome.bass.steps },
    { hits: genome.closedHat.hits, steps: genome.closedHat.steps },
    { hits: genome.openHat.hits, steps: genome.openHat.steps },
    ...genome.percussion.layers.map((layer) => ({
      hits: layer.hits,
      steps: layer.steps,
    })),
  ];
  const hitCount = patterns.reduce(
    (total, pattern) => total + pattern.hits.length,
    0,
  );
  if (hitCount === 0) return 0;

  const offbeatHits = patterns.reduce(
    (total, pattern) =>
      total + pattern.hits.filter((hit) => hit % 4 !== 0).length,
    0,
  );
  return offbeatHits / hitCount;
}

function developmentAmount(genome: MusicGenome): number {
  const value = genome.development;
  const components = [
    Math.abs(value.densityDelta) / STYLE_ENVELOPE.development.densityDelta.max,
    value.bassVariation ? 1 : 0,
    value.hatVariation ? 1 : 0,
    Math.abs(value.percussionChange),
    Math.abs(value.filterMovement) /
      STYLE_ENVELOPE.development.filterMovement.max,
    Math.abs(value.probabilityDelta) /
      STYLE_ENVELOPE.development.probabilityDelta.max,
    Math.abs(value.rotationDelta) /
      STYLE_ENVELOPE.development.rotationDelta.max,
    Math.abs(value.energyDelta) / STYLE_ENVELOPE.development.energyDelta.max,
  ];
  return clamp01(
    components.reduce((total, component) => total + component, 0) /
      components.length,
  );
}

export function extractGenomeFeatures(genome: MusicGenome): GenomeFeatures {
  const percussionDensity =
    genome.percussion.layers.reduce(
      (total, layer) => total + rhythmDensity(layer),
      0,
    ) / genome.percussion.layers.length;

  return {
    bassDensity: clamp01(genome.bass.hits.length / genome.bass.steps),
    bassPitchVariety: clamp01((genome.bass.pitchSet.length - 1) / 6),
    hatDensity: clamp01(
      (rhythmDensity(genome.closedHat) + rhythmDensity(genome.openHat)) / 2,
    ),
    percussionDensity: clamp01(percussionDensity),
    syncopation: clamp01(syncopationScore(genome)),
    brightness: normalize(
      genome.sound.filterCutoff,
      STYLE_ENVELOPE.sound.filterCutoff,
    ),
    roughness: clamp01(
      (genome.sound.drive + genome.sound.resonance + genome.sound.noiseAmount) /
        3,
    ),
    space: clamp01(
      (genome.sound.reverbAmount / STYLE_ENVELOPE.sound.reverbAmount.max +
        genome.sound.delayAmount / STYLE_ENVELOPE.sound.delayAmount.max) /
        2,
    ),
    developmentAmount: developmentAmount(genome),
    mutationRate: normalize(
      genome.mutationStrategy.mutationRate,
      STYLE_ENVELOPE.mutation.mutationRate,
    ),
  };
}

export function genomeFeatureVector(genome: MusicGenome): number[] {
  const features = extractGenomeFeatures(genome);
  return GENOME_FEATURE_KEYS.map((key) => features[key]);
}
