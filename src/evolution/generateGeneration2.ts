import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { STRUDEL_COMPILER_VERSION } from '../audio/strudel/CompiledStrudelPattern';
import foundersJson from '../data/founders.v0.1.json';
import generation0RatingsJson from '../data/generation-0-ratings.v1.json';
import generation1Json from '../data/generation-1.v0.1.json';
import generation1MetadataJson from '../data/generation-1.v0.1.meta.json';
import generation1RatingsJson from '../data/generation-1-ratings.v1.json';
import type { MusicGenome } from '../genome/MusicGenome';
import {
  GENERATION_2_DATASET_VERSION,
  GENERATION_2_MASTER_SEED,
} from './GenerationConfig';
import { FITNESS_POLICY_VERSION, buildFitnessHistory } from './FitnessHistory';
import {
  canonicalFitnessHistoryInputs,
  fitnessHistoryProvenanceHash,
} from './FitnessProvenance';
import { generateGeneration2, generation2Report } from './Generation2';
import type {
  CanonicalRatingsDataset,
  FitnessHistoryInputProvenance,
  Generation2DatasetMetadata,
  GenerationDatasetMetadata,
} from './GenerationTypes';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(sourceDirectory, '../data/generation-2.v0.1.json');
const metadataPath = resolve(
  sourceDirectory,
  '../data/generation-2.v0.1.meta.json',
);

const founders = foundersJson as unknown as MusicGenome[];
const generation0Ratings =
  generation0RatingsJson as unknown as CanonicalRatingsDataset;
const generation1 = generation1Json as unknown as MusicGenome[];
const generation1Ratings =
  generation1RatingsJson as unknown as CanonicalRatingsDataset;
const generation1Metadata =
  generation1MetadataJson as GenerationDatasetMetadata;

function canonicalFileSha256(relativePath: string): string {
  return createHash('sha256')
    .update(readFileSync(resolve(sourceDirectory, relativePath), 'utf8'))
    .digest('hex')
    .toUpperCase();
}

const foundersSha256 = canonicalFileSha256('../data/founders.v0.1.json');
const generation0RatingsFileSha256 = canonicalFileSha256(
  '../data/generation-0-ratings.v1.json',
);
const generation1Sha256 = canonicalFileSha256('../data/generation-1.v0.1.json');
const generation1RatingsFileSha256 = canonicalFileSha256(
  '../data/generation-1-ratings.v1.json',
);
if (
  generation0Ratings.generation !== 0 ||
  foundersSha256 !== generation0Ratings.datasetSha256
) {
  throw new Error(`Founder dataset identity mismatch: ${foundersSha256}.`);
}
if (
  generation1Metadata.generation !== 1 ||
  generation1Ratings.generation !== 1 ||
  generation1Sha256 !== generation1Metadata.datasetSha256 ||
  generation1Sha256 !== generation1Ratings.datasetSha256
) {
  throw new Error(`Generation 1 dataset hash mismatch: ${generation1Sha256}.`);
}

const fitnessHistoryInputs = canonicalFitnessHistoryInputs([
  {
    generation: 0,
    populationDatasetVersion: generation0Ratings.datasetVersion,
    populationDatasetSha256: foundersSha256,
    ratingsDatasetVersion: generation0Ratings.version,
    ratingsFileSha256: generation0RatingsFileSha256,
  },
  {
    generation: 1,
    populationDatasetVersion: generation1Metadata.datasetVersion,
    populationDatasetSha256: generation1Sha256,
    ratingsDatasetVersion: generation1Ratings.version,
    ratingsFileSha256: generation1RatingsFileSha256,
  },
]) satisfies FitnessHistoryInputProvenance[];
const fitnessHistorySha256 = fitnessHistoryProvenanceHash(fitnessHistoryInputs);

const generation = generateGeneration2(
  founders,
  generation0Ratings,
  generation1,
  generation1Ratings,
);
const serialized = await format(JSON.stringify(generation), { parser: 'json' });
const datasetSha256 = createHash('sha256')
  .update(serialized)
  .digest('hex')
  .toUpperCase();

const metadata: Generation2DatasetMetadata = {
  version: '1',
  generation: 2,
  datasetVersion: GENERATION_2_DATASET_VERSION,
  datasetSha256,
  masterSeed: GENERATION_2_MASTER_SEED,
  sourceDatasetVersion: generation1Metadata.datasetVersion,
  sourceDatasetSha256: generation1Metadata.datasetSha256,
  ratingsDatasetVersion: generation1Ratings.version,
  fitnessHistoryInputs,
  fitnessHistorySha256,
  fitnessPolicyVersion: FITNESS_POLICY_VERSION,
  phenotypeCompilerVersion: STRUDEL_COMPILER_VERSION,
};

mkdirSync(dirname(datasetPath), { recursive: true });
writeFileSync(datasetPath, serialized, 'utf8');
writeFileSync(
  metadataPath,
  await format(JSON.stringify(metadata), { parser: 'json' }),
  'utf8',
);

const observations = buildFitnessHistory([
  { population: founders, ratings: generation0Ratings },
  { population: generation1, ratings: generation1Ratings },
]);
const observationCounts = observations.reduce<Map<string, number>>(
  (counts, observation) =>
    counts.set(
      observation.phenotypeHash,
      (counts.get(observation.phenotypeHash) ?? 0) + 1,
    ),
  new Map(),
);

console.log(
  JSON.stringify(
    {
      datasetPath,
      metadataPath,
      datasetSha256,
      fitnessHistorySha256,
      fitnessHistoryInputs,
      organisms: generation.length,
      uniquePhenotypes: observationCounts.size,
      repeatedPhenotypes: [...observationCounts.values()].filter(
        (count) => count > 1,
      ).length,
      elites: generation
        .slice(0, 7)
        .map((genome) => genome.lineage.sourceGenomeId),
      report: generation2Report(generation),
    },
    null,
    2,
  ),
);
