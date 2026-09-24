import { describe, expect, it } from 'vitest';
import {
  createRatingsExport,
  findNextUnratedIndex,
  GENERATION_0_IDENTITY,
  RatingRepository,
  RATINGS_STORAGE_KEY,
  type KeyValueStorage,
  type RatingDatasetIdentity,
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

const generation1: RatingDatasetIdentity = {
  generation: 1,
  datasetVersion: 'v0.1',
  datasetSha256: 'G1HASH',
};

describe('RatingRepository', () => {
  it('persists and replaces scores including neutral zero', () => {
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
    expect(repository.load().get('founder-001')).toMatchObject({
      ...GENERATION_0_IDENTITY,
      genomeId: 'founder-001',
      score: 2,
      ratedAt: '2026-01-02',
    });
  });

  it('keeps G0 and G1 ratings in separate versioned storage', () => {
    const storage = new MemoryStorage();
    const g0 = new RatingRepository(storage);
    const g1 = new RatingRepository(storage, generation1);
    g0.save({ genomeId: 'founder-001', score: 2, ratedAt: 'g0' });
    g1.save({ genomeId: 'gen1-001', score: -1, ratedAt: 'g1' });
    expect([...g0.load().keys()]).toEqual(['founder-001']);
    expect([...g1.load().keys()]).toEqual(['gen1-001']);
  });

  it('supports arbitrary non-negative generation identities', () => {
    const identity: RatingDatasetIdentity = {
      generation: 7,
      datasetVersion: 'v7.3',
      datasetSha256: 'GEN7HASH',
    };
    const repository = new RatingRepository(new MemoryStorage(), identity);
    repository.save({ genomeId: 'gen7-001', score: 1, ratedAt: 'future' });

    expect(repository.load().get('gen7-001')).toMatchObject(identity);
    expect(
      createRatingsExport(repository.load(), identity, 'now'),
    ).toMatchObject(identity);
  });

  it('migrates legacy G0 ratings without exposing them to G1', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      RATINGS_STORAGE_KEY,
      JSON.stringify([
        { genomeId: 'founder-001', score: 0, ratedAt: 'legacy' },
      ]),
    );
    expect(new RatingRepository(storage).load().get('founder-001')?.score).toBe(
      0,
    );
    expect(new RatingRepository(storage, generation1).load().size).toBe(0);
  });

  it('treats zero as rated when finding the next organism', () => {
    const genomes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const repository = new RatingRepository(new MemoryStorage(), generation1);
    repository.save({ genomeId: 'a', score: 1, ratedAt: 'now' });
    const ratings = repository.save({
      genomeId: 'b',
      score: 0,
      ratedAt: 'now',
    });
    expect(findNextUnratedIndex(genomes, ratings, 0)).toBe(2);
  });

  it('exports stable generation identity and sorted ratings', () => {
    const repository = new RatingRepository(new MemoryStorage(), generation1);
    repository.save({ genomeId: 'b', score: -1, ratedAt: 'then' });
    const ratings = repository.save({
      genomeId: 'a',
      score: 2,
      ratedAt: 'now',
    });
    const exported = createRatingsExport(
      ratings,
      generation1,
      '2026-09-23T00:00:00.000Z',
    );
    expect(exported).toMatchObject({
      version: '2',
      generation: 1,
      datasetSha256: 'G1HASH',
    });
    expect(exported.ratings.map((rating) => rating.genomeId)).toEqual([
      'a',
      'b',
    ]);
  });
});
