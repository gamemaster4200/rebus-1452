import * as bundledStrudel from '@strudel/web';
import type { CompiledStrudelPattern } from './CompiledStrudelPattern';

interface StrudelPattern {
  readonly _Pattern: true;
}

interface StrudelRepl {
  readonly scheduler: { now(): number };
  setCps(cps: number): void;
  setPattern(pattern: StrudelPattern, autostart?: boolean): Promise<unknown>;
  stop(): void;
}

interface AudioParamLike {
  cancelScheduledValues(time: number): void;
  setValueAtTime(value: number, time: number): void;
}

interface Disconnectable {
  disconnect(): void;
}

interface MasterGainNode {
  readonly gain: AudioParamLike;
}

interface SuperdoughAudioController {
  readonly output: {
    readonly destinationGain: MasterGainNode | null;
    disconnect(): void;
  };
  readonly nodes: Readonly<Record<string, Disconnectable>>;
  readonly buses: Readonly<Record<string, Disconnectable>>;
}

export interface StrudelModule {
  defaultPrebake(): Promise<void>;
  getAudioContext(): AudioContext;
  getSuperdoughAudioController(): SuperdoughAudioController;
  initAudio(options?: { maxPolyphony?: number }): Promise<void>;
  pure(value: Readonly<Record<string, unknown>>): StrudelPattern;
  sequence(...patterns: StrudelPattern[]): StrudelPattern;
  setSuperdoughAudioController(
    controller: SuperdoughAudioController | null,
  ): SuperdoughAudioController | null;
  setTime(getTime: () => number): void;
  slowcat(...patterns: StrudelPattern[]): StrudelPattern;
  stack(...patterns: StrudelPattern[]): StrudelPattern;
  readonly silence: StrudelPattern;
  readonly transpiler: unknown;
  webaudioRepl(options: { transpiler: unknown }): StrudelRepl;
}

export type StrudelModuleLoader = () => StrudelModule;

export interface CompiledAudioEngine {
  play(compiled: CompiledStrudelPattern): Promise<void>;
  stop(): void;
}

const loadStrudelModule: StrudelModuleLoader = () =>
  bundledStrudel as StrudelModule;

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
  private initialization: Promise<void> | null = null;
  private activeController: SuperdoughAudioController | null = null;
  private readonly retiredControllers = new WeakSet<object>();
  private operation = 0;

  constructor(
    private readonly loadModule: StrudelModuleLoader = loadStrudelModule,
  ) {}

  private initialize(): Promise<void> {
    this.initialization ??= this.createRuntime();
    return this.initialization;
  }

  private async createRuntime(): Promise<void> {
    const module = this.loadModule();
    this.module = module;

    // Do not use initStrudel here: it defers audio initialization until the
    // *next* mousedown. The first Play click must initialize the full engine.
    const repl = module.webaudioRepl({ transpiler: module.transpiler });
    module.setTime(() => repl.scheduler.now());
    await Promise.all([
      module.defaultPrebake(),
      module.initAudio({ maxPolyphony: 32 }),
    ]);
    repl.setCps(0.5);
    this.repl = repl;
  }

  async play(compiled: CompiledStrudelPattern): Promise<void> {
    const operation = ++this.operation;
    this.halt();
    await this.initialize();
    if (operation !== this.operation) return;

    const module = this.module;
    const repl = this.repl;
    if (!module || !repl)
      throw new Error('Strudel runtime failed to initialize.');

    repl.setCps(0.5);
    this.activeController = this.createAudioGeneration(module);
    const bars = Array.from({ length: compiled.bars }, (_, bar) =>
      buildBarPattern(module, compiled, bar),
    );

    try {
      await repl.setPattern(module.slowcat(...bars), true);
    } catch (error) {
      if (operation === this.operation) this.halt();
      throw error;
    }

    if (operation !== this.operation) this.halt();
  }

  stop(): void {
    this.operation += 1;
    this.halt();
  }

  private createAudioGeneration(
    module: StrudelModule,
  ): SuperdoughAudioController {
    const previous = module.getSuperdoughAudioController();
    module.setSuperdoughAudioController(null);
    const next = module.getSuperdoughAudioController();
    this.setReferenceOutputGain(module, next);
    this.retireController(previous);
    return next;
  }

  private setReferenceOutputGain(
    module: StrudelModule,
    controller: SuperdoughAudioController,
  ): void {
    const context = module.getAudioContext();
    const output = controller.output.destinationGain;
    if (!output) throw new Error('SuperDough created no master output node.');
    output.gain.setValueAtTime(0.55, context.currentTime);
  }

  private halt(): void {
    this.repl?.stop();
    if (!this.activeController) return;
    this.retireController(this.activeController);
    this.activeController = null;
  }

  /**
   * Mutes and disconnects one playback generation without mutating the global
   * controller. In-flight async notes keep their old, permanently silent graph.
   */
  private retireController(controller: SuperdoughAudioController): void {
    if (this.retiredControllers.has(controller)) return;
    this.retiredControllers.add(controller);

    const now = this.module?.getAudioContext().currentTime ?? 0;
    const gain = controller.output.destinationGain?.gain;
    gain?.cancelScheduledValues(now);
    gain?.setValueAtTime(0, now);
    Object.values(controller.nodes).forEach((node) => node.disconnect());
    Object.values(controller.buses).forEach((node) => node.disconnect());
    controller.output.disconnect();
  }
}
