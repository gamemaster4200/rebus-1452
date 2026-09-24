import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import foundersJson from '../data/founders.v0.1.json';
import ratingsJson from '../data/generation-0-ratings.v1.json';
import type { MusicGenome } from '../genome/MusicGenome';
import {
  GENERATION_1_DATASET_VERSION,
  GENERATION_1_MASTER_SEED,
} from './GenerationConfig';
import { generateGeneration1, generation1Report } from './Generation1';
import type {
  CanonicalRatingsDataset,
  GenerationDatasetMetadata,
} from './GenerationTypes';

const sourceDirectory = dirname(fileURLToPath(import.meta.url));
const datasetPath = resolve(sourceDirectory, '../data/generation-1.v0.1.json');
const metadataPath = resolve(
  sourceDirectory,
  '../data/generation-1.v0.1.meta.json',
);

const founders = foundersJson as unknown as MusicGenome[];
const ratings = ratingsJson as unknown as CanonicalRatingsDataset;
const generation = generateGeneration1(founders, ratings);
const serialized = await format(JSON.stringify(generation), { parser: 'json' });
const datasetSha256 = createHash('sha256')
  .update(serialized)
  .digest('hex')
  .toUpperCase();
const canonicalFounders = `${JSON.stringify(foundersJson, null, 2)}\n`;
const foundersSha256 = createHash('sha256')
  .update(canonicalFounders)
  .digest('hex')
  .toUpperCase();
if (foundersSha256 !== ratings.datasetSha256) {
  throw new Error(`Founder dataset hash mismatch: ${foundersSha256}.`);
}

const metadata: GenerationDatasetMetadata = {
  version: '1',
  generation: 1,
  datasetVersion: GENERATION_1_DATASET_VERSION,
  datasetSha256,
  masterSeed: GENERATION_1_MASTER_SEED,
  sourceDatasetVersion: ratings.datasetVersion,
  sourceDatasetSha256: ratings.datasetSha256,
  ratingsDatasetVersion: ratings.version,
};

mkdirSync(dirname(datasetPath), { recursive: true });
writeFileSync(datasetPath, serialized, 'utf8');
writeFileSync(
  metadataPath,
  await format(JSON.stringify(metadata), { parser: 'json' }),
  'utf8',
);

console.log(
  JSON.stringify(
    {
      datasetPath,
      metadataPath,
      datasetSha256,
      organisms: generation.length,
      report: generation1Report(generation),
    },
    null,
    2,
  ),
);
