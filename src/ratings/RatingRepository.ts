import type { MusicGenome } from '../genome/MusicGenome';

export type FounderScore = -2 | -1 | 0 | 1 | 2;

export interface FounderRating {
  readonly genomeId: string;
  readonly score: FounderScore;
  readonly ratedAt: string;
}

export interface RatingsExport {
  readonly version: '1';
  readonly founderDataset: 'v0.1';
  readonly founderDatasetSha256: string;
  readonly exportedAt: string;
  readonly ratings: readonly FounderRating[];
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const RATINGS_STORAGE_KEY = 'rebus-1452:ratings:v1';
export const FOUNDER_DATASET_SHA256 =
  '3D3E1A354CE56AC535183283F5BEDC547B0CF57B5238D4F5E921A8C267290FF3';

function isScore(value: unknown): value is FounderScore {
  return (
    value === -2 || value === -1 || value === 0 || value === 1 || value === 2
  );
}

function isRating(value: unknown): value is FounderRating {
  if (!value || typeof value !== 'object') return false;
  const rating = value as Partial<FounderRating>;
  return (
    typeof rating.genomeId === 'string' &&
    isScore(rating.score) &&
    typeof rating.ratedAt === 'string'
  );
}

export class RatingRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly storageKey = RATINGS_STORAGE_KEY,
  ) {}

  load(): Map<string, FounderRating> {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return new Map();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Map();
      return new Map(
        parsed.filter(isRating).map((rating) => [rating.genomeId, rating]),
      );
    } catch {
      return new Map();
    }
  }

  save(rating: FounderRating): Map<string, FounderRating> {
    const ratings = this.load();
    ratings.set(rating.genomeId, rating);
    this.write(ratings);
    return ratings;
  }

  private write(ratings: ReadonlyMap<string, FounderRating>): void {
    const sorted = [...ratings.values()].sort((a, b) =>
      a.genomeId.localeCompare(b.genomeId),
    );
    this.storage.setItem(this.storageKey, JSON.stringify(sorted));
  }
}

export function findNextUnratedIndex(
  founders: readonly Pick<MusicGenome, 'id'>[],
  ratings: ReadonlyMap<string, FounderRating>,
  currentIndex: number,
): number | null {
  for (let offset = 1; offset <= founders.length; offset += 1) {
    const index = (currentIndex + offset) % founders.length;
    const founder = founders[index];
    if (founder && !ratings.has(founder.id)) return index;
  }
  return null;
}

export function createRatingsExport(
  ratings: ReadonlyMap<string, FounderRating>,
  exportedAt = new Date().toISOString(),
): RatingsExport {
  return {
    version: '1',
    founderDataset: 'v0.1',
    founderDatasetSha256: FOUNDER_DATASET_SHA256,
    exportedAt,
    ratings: [...ratings.values()].sort((a, b) =>
      a.genomeId.localeCompare(b.genomeId),
    ),
  };
}
