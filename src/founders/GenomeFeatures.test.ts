import { describe, expect, it } from 'vitest';
import { generateFounderPopulation } from './FounderGenerator';
import { GENOME_FEATURE_KEYS, extractGenomeFeatures } from './GenomeFeatures';

describe('genome feature extraction', () => {
  const founder = generateFounderPopulation()[16];

  it('is deterministic', () => {
    expect(extractGenomeFeatures(founder)).toEqual(
      extractGenomeFeatures(founder),
    );
  });

  it('returns normalized values for every declared feature', () => {
    const features = extractGenomeFeatures(founder);
    expect(Object.keys(features)).toEqual(GENOME_FEATURE_KEYS);
    Object.values(features).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
  });
});
