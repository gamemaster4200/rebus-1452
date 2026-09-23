import { describe, expect, it } from 'vitest';
import { analyzeFounderDiversity, validateFounderDiversity } from './Diversity';
import { generateFounderPopulation } from './FounderGenerator';

describe('founder diversity', () => {
  const founders = generateFounderPopulation();

  it('keeps the canonical population out of near-clone territory', () => {
    const report = analyzeFounderDiversity(founders);
    expect(validateFounderDiversity(founders)).toEqual([]);
    expect(report.minimumDistance).toBeGreaterThanOrEqual(0.045);
    expect(report.meanDistance).toBeGreaterThanOrEqual(0.2);
  });
});
