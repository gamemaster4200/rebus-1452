import { describe, expect, it } from 'vitest';
import {
  createRatingsExport,
  findNextUnratedIndex,
  RatingRepository,
  type KeyValueStorage,
} from './RatingRepository';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('RatingRepository', () => {
  it('persists, loads, and replaces scores including neutral zero', () => {
    const repository = new RatingRepository(new MemoryStorage());
    repository.save({
      genomeId: 'founder-001',
      score: 0,
      ratedAt: '2026-01-01',
    });
    repository.save({
      genomeId: 'founder-001',
      score: 2,
      ratedAt: '2026-01-02',
    });

    expect(repository.load().get('founder-001')).toEqual({
      genomeId: 'founder-001',
      score: 2,
      ratedAt: '2026-01-02',
    });
  });

  it('treats zero as rated when finding the next founder', () => {
    const founders = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const ratings = new Map([
      ['a', { genomeId: 'a', score: 1 as const, ratedAt: 'now' }],
      ['b', { genomeId: 'b', score: 0 as const, ratedAt: 'now' }],
    ]);
    expect(findNextUnratedIndex(founders, ratings, 0)).toBe(2);
  });

  it('exports stable JSON metadata and sorted ratings', () => {
    const ratings = new Map([
      ['b', { genomeId: 'b', score: -1 as const, ratedAt: 'then' }],
      ['a', { genomeId: 'a', score: 2 as const, ratedAt: 'now' }],
    ]);
    const exported = createRatingsExport(ratings, '2026-09-23T00:00:00.000Z');
    expect(exported.version).toBe('1');
    expect(exported.founderDataset).toBe('v0.1');
    expect(exported.ratings.map((rating) => rating.genomeId)).toEqual([
      'a',
      'b',
    ]);
  });
});
