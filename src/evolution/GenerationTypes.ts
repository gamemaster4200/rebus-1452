import type { FounderScore } from '../ratings/RatingRepository';

export interface CanonicalRatingInput {
  readonly genomeId: string;
  readonly score: FounderScore;
  readonly ratedAt?: string;
}

export interface PopulationRatingsDataset {
  readonly version: string;
  readonly generation: number;
  readonly datasetVersion: string;
  readonly datasetSha256: string;
  readonly ratings: readonly CanonicalRatingInput[];
}

export interface CanonicalRatingsDataset extends PopulationRatingsDataset {
  readonly version: '1';
  readonly datasetVersion: 'v0.1';
}

export interface GenerationDatasetMetadata {
  readonly version: string;
  readonly generation: number;
  readonly datasetVersion: string;
  readonly datasetSha256: string;
  readonly masterSeed: string;
  readonly sourceDatasetVersion: string;
  readonly sourceDatasetSha256: string;
  readonly ratingsDatasetVersion: string;
}

export interface Generation2DatasetMetadata extends GenerationDatasetMetadata {
  readonly generation: 2;
  readonly sourceRatingsDatasetVersion: string;
  readonly sourceRatingsDatasetSha256: string;
  readonly fitnessPolicyVersion: string;
  readonly phenotypeCompilerVersion: string;
}
