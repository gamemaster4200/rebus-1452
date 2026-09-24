import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeFounderDiversity } from './Diversity';
import {
  FOUNDER_MASTER_SEED,
  generateFounderPopulation,
} from './FounderGenerator';
import { assertValidFounderDataset } from './validateFounderDataset';

const outputPath = fileURLToPath(
  new URL('../data/founders.v0.1.json', import.meta.url),
);
const founders = generateFounderPopulation();
assertValidFounderDataset(founders);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(founders, null, 2)}\n`, 'utf8');

const diversity = analyzeFounderDiversity(founders);
console.log(
  JSON.stringify(
    {
      output: outputPath,
      masterSeed: FOUNDER_MASTER_SEED,
      founders: founders.length,
      minimumDistance: Number(diversity.minimumDistance.toFixed(4)),
      meanDistance: Number(diversity.meanDistance.toFixed(4)),
      axisRanges: Object.fromEntries(
        Object.entries(diversity.axisRanges).map(([key, value]) => [
          key,
          Number(value.toFixed(4)),
        ]),
      ),
    },
    null,
    2,
  ),
);
