import {
  FOUNDER_FAMILIES,
  type FounderFamily,
  type MusicGenome,
} from '../genome/MusicGenome';
import { validateMusicGenome } from '../genome/validateMusicGenome';
import {
  FOUNDER_COUNT,
  FOUNDER_MASTER_SEED,
  FOUNDERS_PER_FAMILY,
  founderSeed,
} from './FounderGenerator';
import { validateFounderDiversity } from './Diversity';

function musicalFingerprint(genome: MusicGenome): string {
  return JSON.stringify({
    global: genome.global,
    bass: genome.bass,
    closedHat: genome.closedHat,
    openHat: genome.openHat,
    percussion: genome.percussion,
    harmony: genome.harmony,
    sound: genome.sound,
    development: genome.development,
    interaction: genome.interaction,
    mutationStrategy: genome.mutationStrategy,
  });
}

export function validateFounderDataset(
  genomes: readonly MusicGenome[],
  masterSeed = FOUNDER_MASTER_SEED,
): string[] {
  const errors: string[] = [];

  if (genomes.length !== FOUNDER_COUNT) {
    errors.push(
      `Founder dataset must contain exactly ${FOUNDER_COUNT} genomes.`,
    );
  }

  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  const familyCounts = Object.fromEntries(
    FOUNDER_FAMILIES.map((family) => [family, 0]),
  ) as Record<FounderFamily, number>;

  genomes.forEach((genome, index) => {
    const founderNumber = index + 1;
    const expectedId = `founder-${String(founderNumber).padStart(3, '0')}`;

    if (genome.id !== expectedId) {
      errors.push(
        `Expected ${expectedId} at dataset position ${founderNumber}.`,
      );
    }
    if (ids.has(genome.id)) errors.push(`Duplicate founder ID: ${genome.id}.`);
    ids.add(genome.id);

    if (genome.founderId !== founderNumber) {
      errors.push(`${genome.id} has an invalid founderId.`);
    }
    if (genome.seed !== founderSeed(founderNumber, masterSeed)) {
      errors.push(`${genome.id} has an invalid deterministic seed.`);
    }
    if (
      genome.lineage.generation !== 0 ||
      !genome.lineage.isFounder ||
      genome.lineage.parents.length !== 0
    ) {
      errors.push(`${genome.id} has invalid founder lineage metadata.`);
    }
    if (!genome.family || !FOUNDER_FAMILIES.includes(genome.family)) {
      errors.push(`${genome.id} has an invalid family.`);
    } else {
      familyCounts[genome.family] += 1;
    }

    validateMusicGenome(genome).forEach((error) =>
      errors.push(`${genome.id}: ${error}`),
    );

    const fingerprint = musicalFingerprint(genome);
    if (fingerprints.has(fingerprint)) {
      errors.push(`${genome.id} duplicates another founder genome.`);
    }
    fingerprints.add(fingerprint);
  });

  FOUNDER_FAMILIES.forEach((family) => {
    if (familyCounts[family] !== FOUNDERS_PER_FAMILY) {
      errors.push(
        `${family} must contain exactly ${FOUNDERS_PER_FAMILY} founders.`,
      );
    }
  });

  if (genomes.length >= 2) {
    errors.push(...validateFounderDiversity(genomes));
  }

  return errors;
}

export function assertValidFounderDataset(
  genomes: readonly MusicGenome[],
  masterSeed = FOUNDER_MASTER_SEED,
): void {
  const errors = validateFounderDataset(genomes, masterSeed);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}
