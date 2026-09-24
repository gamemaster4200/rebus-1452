import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FOUNDER_FAMILIES,
  type FounderFamily,
  type MusicGenome,
} from '../genome/MusicGenome';
import {
  FOUNDER_COUNT,
  FOUNDERS_PER_FAMILY,
  generateFounderPopulation,
} from './FounderGenerator';
import { validateFounderDataset } from './validateFounderDataset';

const founders = generateFounderPopulation();

describe('founder generator', () => {
  it('creates 42 ordered, unique, valid founders', () => {
    expect(founders).toHaveLength(FOUNDER_COUNT);
    expect(founders.map(({ id }) => id)).toEqual(
      Array.from(
        { length: FOUNDER_COUNT },
        (_, index) => `founder-${String(index + 1).padStart(3, '0')}`,
      ),
    );
    expect(validateFounderDataset(founders)).toEqual([]);
  });

  it('contains seven metadata families with six founders each', () => {
    const counts = founders.reduce(
      (result, founder) => {
        result[founder.family as FounderFamily] += 1;
        return result;
      },
      Object.fromEntries(
        FOUNDER_FAMILIES.map((family) => [family, 0]),
      ) as Record<FounderFamily, number>,
    );

    expect(counts).toEqual(
      Object.fromEntries(
        FOUNDER_FAMILIES.map((family) => [family, FOUNDERS_PER_FAMILY]),
      ),
    );
  });

  it('is deterministic', () => {
    expect(generateFounderPopulation()).toEqual(founders);
  });

  it('matches the canonical dataset', () => {
    const canonical = JSON.parse(
      readFileSync(
        resolve(process.cwd(), 'src/data/founders.v0.1.json'),
        'utf8',
      ),
    ) as MusicGenome[];
    expect(canonical).toEqual(founders);
  });
});
