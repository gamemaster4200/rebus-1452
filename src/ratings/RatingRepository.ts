import type { MusicGenome } from '../genome/MusicGenome';

export type FounderScore = -2 | -1 | 0 | 1 | 2;
export type RatingGeneration = number;

export interface RatingDatasetIdentity {
  readonly generation: RatingGeneration;
  readonly datasetVersion: string;
  readonly datasetSha256: string;
}

export interface FounderRating extends RatingDatasetIdentity {
  readonly genomeId: string;
  readonly score: FounderScore;
  readonly ratedAt: string;
}

export type RatingInput = Pick<FounderRating, 'genomeId' | 'score' | 'ratedAt'>;

export interface RatingsExport extends RatingDatasetIdentity {
  readonly version: '2';
  readonly exportedAt: string;
  readonly ratings: readonly FounderRating[];
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Legacy G0 key retained solely for a one-way read migration. */
export const RATINGS_STORAGE_KEY = 'rebus-1452:ratings:v1';
export const FOUNDER_DATASET_SHA256 =
  '3D3E1A354CE56AC535183283F5BEDC547B0CF57B5238D4F5E921A8C267290FF3';
export const GENERATION_0_IDENTITY: RatingDatasetIdentity = {
  generation: 0,
  datasetVersion: 'v0.1',
  datasetSha256: FOUNDER_DATASET_SHA256,
};

function isScore(value: unknown): value is FounderScore {
  return (
    value === -2 || value === -1 || value === 0 || value === 1 || value === 2
  );
}

function isLegacyRating(value: unknown): value is RatingInput {
  if (!value || typeof value !== 'object') return false;
  const rating = value as Partial<RatingInput>;
  return (
    typeof rating.genomeId === 'string' &&
    isScore(rating.score) &&
    typeof rating.ratedAt === 'string'
  );
}

function isRatingFor(
  value: unknown,
  identity: RatingDatasetIdentity,
): value is FounderRating {
  if (!isLegacyRating(value)) return false;
  const rating = value as Partial<FounderRating>;
  return (
    rating.generation === identity.generation &&
    rating.datasetVersion === identity.datasetVersion &&
    rating.datasetSha256 === identity.datasetSha256
  );
}

function storageKey(identity: RatingDatasetIdentity): string {
  return `rebus-1452:ratings:v2:g${identity.generation}:${identity.datasetVersion}:${identity.datasetSha256}`;
}

export class RatingRepository {
  private readonly storageKey: string;

  constructor(
    private readonly storage: KeyValueStorage,
    readonly identity: RatingDatasetIdentity = GENERATION_0_IDENTITY,
  ) {
    if (!Number.isInteger(identity.generation) || identity.generation < 0) {
      throw new Error('Rating generation must be a non-negative integer.');
    }
    this.storageKey = storageKey(identity);
  }

  load(): Map<string, FounderRating> {
    const current = this.readCurrent();
    if (current.size > 0 || this.storage.getItem(this.storageKey))
      return current;
    if (this.identity.generation !== 0) return current;
    const legacy = this.readLegacy();
    if (legacy.size > 0) this.write(legacy);
    return legacy;
  }

  save(input: RatingInput): Map<string, FounderRating> {
    const ratings = this.load();
    ratings.set(input.genomeId, { ...this.identity, ...input });
    this.write(ratings);
    return ratings;
  }

  private readCurrent(): Map<string, FounderRating> {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return new Map();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Map();
      return new Map(
        parsed
          .filter((rating) => isRatingFor(rating, this.identity))
          .map((rating) => [rating.genomeId, rating]),
      );
    } catch {
      return new Map();
    }
  }

  private readLegacy(): Map<string, FounderRating> {
    const raw = this.storage.getItem(RATINGS_STORAGE_KEY);
    if (!raw) return new Map();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Map();
      return new Map(
        parsed
          .filter(isLegacyRating)
          .map((rating) => [rating.genomeId, { ...this.identity, ...rating }]),
      );
    } catch {
      return new Map();
    }
  }

  private write(ratings: ReadonlyMap<string, FounderRating>): void {
    const sorted = [...ratings.values()].sort((a, b) =>
      a.genomeId.localeCompare(b.genomeId),
    );
    this.storage.setItem(this.storageKey, JSON.stringify(sorted));
  }
}

export function findNextUnratedIndex(
  genomes: readonly Pick<MusicGenome, 'id'>[],
  ratings: ReadonlyMap<string, FounderRating>,
  currentIndex: number,
): number | null {
  for (let offset = 1; offset <= genomes.length; offset += 1) {
    const index = (currentIndex + offset) % genomes.length;
    const genome = genomes[index];
    if (genome && !ratings.has(genome.id)) return index;
  }
  return null;
}

export function createRatingsExport(
  ratings: ReadonlyMap<string, FounderRating>,
  identity: RatingDatasetIdentity = GENERATION_0_IDENTITY,
  exportedAt = new Date().toISOString(),
): RatingsExport {
  return {
    version: '2',
    ...identity,
    exportedAt,
    ratings: [...ratings.values()].sort((a, b) =>
      a.genomeId.localeCompare(b.genomeId),
    ),
  };
}
