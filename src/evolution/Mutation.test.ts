import { describe, expect, it } from 'vitest';
import foundersJson from '../data/founders.v0.1.json';
import type { MusicGenome, MutationScale } from '../genome/MusicGenome';
import { validateMusicGenome } from '../genome/validateMusicGenome';
import { mutateGenome } from './Mutation';

const founder = (foundersJson as unknown as MusicGenome[])[3];

describe('mutation engine', () => {
  (['micro', 'meso', 'macro'] as const).forEach((scale: MutationScale) => {
    it(`applies a real deterministic ${scale} mutation`, () => {
      const options = { forceScale: scale, operationCount: 2 } as const;
      const first = mutateGenome(founder, `mutation-${scale}`, options);
      const second = mutateGenome(founder, `mutation-${scale}`, options);
      const records = first.lineage.mutations ?? [];

      expect(first).toEqual(second);
      expect(validateMusicGenome(first)).toEqual([]);
      expect(records.length).toBeGreaterThan(0);
      expect(records.every((record) => record.scale === scale)).toBe(true);
      records.forEach((record) => {
        expect(record.before).not.toEqual(record.after);
        expect(record.path.length).toBeGreaterThan(0);
      });
    });
  });
});
