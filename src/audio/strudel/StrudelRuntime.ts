import type { CompiledStrudelPattern } from './CompiledStrudelPattern';

interface StrudelPattern {
  readonly _Pattern: true;
}

interface StrudelRepl {
  setCps(cps: number): void;
  setPattern(pattern: StrudelPattern, autostart?: boolean): Promise<unknown>;
  stop(): void;
}

interface StrudelModule {
  initStrudel(options?: { miniAllStrings?: boolean }): Promise<StrudelRepl>;
  hush(): void;
  pure(value: Readonly<Record<string, unknown>>): StrudelPattern;
  sequence(...patterns: StrudelPattern[]): StrudelPattern;
  stack(...patterns: StrudelPattern[]): StrudelPattern;
  slowcat(...patterns: StrudelPattern[]): StrudelPattern;
  silence: StrudelPattern;
  setMaxPolyphony(value: number): void;
}

export interface CompiledAudioEngine {
  play(compiled: CompiledStrudelPattern): Promise<void>;
  stop(): void;
}

function buildBarPattern(
  module: StrudelModule,
  compiled: CompiledStrudelPattern,
  bar: number,
): StrudelPattern {
  const steps = Array.from({ length: compiled.stepsPerBar }, (_, step) => {
    const events = compiled.events.filter(
      (event) => event.bar === bar && event.step === step,
    );
    if (events.length === 0) return module.silence;
    return module.stack(
      ...events.map((event) =>
        module.pure(
          event.controls as unknown as Readonly<Record<string, unknown>>,
        ),
      ),
    );
  });
  return module.sequence(...steps);
}

/** Browser-only bridge from the deterministic event plan to Strudel/WebAudio. */
export class StrudelAudioEngine implements CompiledAudioEngine {
  private module: StrudelModule | null = null;
  private repl: StrudelRepl | null = null;

  private async initialize(): Promise<void> {
    if (this.module && this.repl) return;
    const imported: unknown = await import('@strudel/web');
    this.module = imported as StrudelModule;
    this.repl = await this.module.initStrudel({ miniAllStrings: false });
    this.module.setMaxPolyphony(48);
    this.repl.setCps(0.5);
  }

  async play(compiled: CompiledStrudelPattern): Promise<void> {
    await this.initialize();
    const module = this.module;
    const repl = this.repl;
    if (!module || !repl)
      throw new Error('Strudel runtime failed to initialize.');

    repl.stop();
    repl.setCps(0.5);
    const bars = Array.from({ length: compiled.bars }, (_, bar) =>
      buildBarPattern(module, compiled, bar),
    );
    await repl.setPattern(module.slowcat(...bars), true);
  }

  stop(): void {
    this.repl?.stop();
  }
}
