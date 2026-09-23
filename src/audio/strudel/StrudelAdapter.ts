import type { MusicGenome } from '../../genome/MusicGenome';
import type { MusicRenderer } from '../MusicRenderer';

export interface StrudelPattern {
  readonly source: string;
}

/**
 * Strudel is loaded only when audio is requested. Compilation and playback are
 * intentionally left for v0.1 so the genome never becomes Strudel source code.
 */
export class StrudelAdapter implements MusicRenderer<StrudelPattern> {
  compile(_genome: MusicGenome): StrudelPattern {
    void _genome;
    throw new Error('Strudel compilation is not implemented yet.');
  }

  async play(_pattern: StrudelPattern): Promise<void> {
    void _pattern;
    await import('@strudel/web');
    throw new Error('Strudel playback is not implemented yet.');
  }

  async stop(): Promise<void> {
    await Promise.resolve();
  }
}
