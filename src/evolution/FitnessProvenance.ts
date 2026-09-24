import { createHash } from 'node:crypto';
import type { FitnessHistoryInputProvenance } from './GenerationTypes';
import { stableCanonicalSerialization } from './FitnessHistory';

export function canonicalFitnessHistoryInputs(
  inputs: readonly FitnessHistoryInputProvenance[],
): FitnessHistoryInputProvenance[] {
  const sorted = [...inputs].sort(
    (left, right) => left.generation - right.generation,
  );
  if (
    sorted.some(
      (input, index) =>
        !Number.isInteger(input.generation) ||
        input.generation < 0 ||
        (index > 0 && input.generation === sorted[index - 1].generation),
    )
  ) {
    throw new Error('Fitness provenance generations must be unique integers.');
  }
  return sorted;
}

export function fitnessHistoryProvenanceHash(
  inputs: readonly FitnessHistoryInputProvenance[],
): string {
  return createHash('sha256')
    .update(stableCanonicalSerialization(canonicalFitnessHistoryInputs(inputs)))
    .digest('hex')
    .toUpperCase();
}
