/**
 * Renderer-independent source of truth for a musical organism.
 * This deliberately stays small until v0.1 establishes the first operators.
 */
export interface MusicGenome {
  readonly id: string;
  readonly seed: number;
  readonly genes: Readonly<Record<string, number | string | boolean>>;
}
