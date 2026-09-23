import type { CompiledStrudelPattern } from './CompiledStrudelPattern';

interface StrudelPattern {
  readonly _Pattern: true;
}

interface StrudelRepl {
  setCps(cps: number): void;
  setPattern(pattern: StrudelPattern, autostart?: boolean): Promise<unknown>;
  stop(): void;
}

export interface StrudelModule {
  initStrudel(options?: { miniAllStrings?: boolean }): Promise<StrudelRepl>;
  resetGlobalEffects(): void;
  pure(value: Readonly<Record<string, unknown>>): StrudelPattern;
  sequence(...patterns: StrudelPattern[]): StrudelPattern;
  stack(...patterns: StrudelPattern[]): StrudelPattern;
  slowcat(...patterns: StrudelPattern[]): StrudelPattern;
  silence: StrudelPattern;
  setMaxPolyphony(value: number): void;
}

export type StrudelModuleLoader = () => Promise<StrudelModule>;

export interface CompiledAudioEngine {
  play(compiled: CompiledStrudelPattern): Promise<void>;
  stop(): void;
}

const loadStrudelModule: StrudelModuleLoader = async () => {
  const imported: unknown = await import('@strudel/web');
  return imported as StrudelModule;
};

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
  private operation = 0;

  constructor(
    private readonly loadModule: StrudelModuleLoader = loadStrudelModule,
  ) {}

  private async initialize(operation: number): Promise<boolean> {
    if (!this.module) this.module = await this.loadModule();
    if (operation !== this.operation) return false;
    if (this.repl) return true;

    const module = this.module;
    const repl = await module.initStrudel({ miniAllStrings: false });
    if (operation !== this.operation) {
      repl.stop();
      module.resetGlobalEffects();
      return false;
    }

    this.repl = repl;
    module.setMaxPolyphony(48);
    repl.setCps(0.5);
    return true;
  }

  async play(compiled: CompiledStrudelPattern): Promise<void> {
    const operation = ++this.operation;
    this.resetAudioGraph();
    if (!(await this.initialize(operation))) return;

    const module = this.module;
    const repl = this.repl;
    if (!module || !repl)
      throw new Error('Strudel runtime failed to initialize.');

    repl.setCps(0.5);
    const bars = Array.from({ length: compiled.bars }, (_, bar) =>
      buildBarPattern(module, compiled, bar),
    );
    await repl.setPattern(module.slowcat(...bars), true);

    if (operation !== this.operation) this.resetAudioGraph();
  }

  stop(): void {
    this.operation += 1;
    this.resetAudioGraph();
  }

  /**
   * Disconnects every SuperDough orbit/effect/output node. Scheduled sources may
   * finish internally, but their former graph no longer reaches the destination.
   */
  private resetAudioGraph(): void {
    this.repl?.stop();
    this.module?.resetGlobalEffects();
  }
}
