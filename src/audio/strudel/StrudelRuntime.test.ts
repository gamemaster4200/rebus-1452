import { describe, expect, it, vi } from 'vitest';
import type { CompiledStrudelPattern } from './CompiledStrudelPattern';
import { StrudelAudioEngine, type StrudelModule } from './StrudelRuntime';

const pattern = { _Pattern: true as const };

function compiled(genomeId: string): CompiledStrudelPattern {
  return {
    compilerVersion: 'strudel-compiler-v2',
    genomeId,
    genomeSeed: genomeId,
    bpm: 120,
    beatsPerBar: 4,
    bars: 16,
    stepsPerBar: 16,
    durationSeconds: 32,
    sectionBoundaryBar: 8,
    events: [],
  };
}

class FakeController {
  readonly cancelScheduledValues = vi.fn();
  readonly setValueAtTime = vi.fn();
  readonly destinationConnect = vi.fn((destination: AudioNode) => destination);
  readonly destinationDisconnect = vi.fn();
  readonly orbitDisconnect = vi.fn();
  readonly busDisconnect = vi.fn();
  readonly outputDisconnect = vi.fn();
  readonly output = {
    destinationGain: {
      gain: {
        cancelScheduledValues: this.cancelScheduledValues,
        setValueAtTime: this.setValueAtTime,
      },
      connect: this.destinationConnect,
      disconnect: this.destinationDisconnect,
    },
    disconnect: this.outputDisconnect,
  };
  readonly nodes = { 1: { disconnect: this.orbitDisconnect } };
  readonly buses = { 1: { disconnect: this.busDisconnect } };

  constructor(readonly audioContext: AudioContext) {}
}

function setup() {
  const limiters: DynamicsCompressorNode[] = [];
  const limiterDisconnects: Array<ReturnType<typeof vi.fn>> = [];
  const createDynamicsCompressor = vi.fn(() => {
    const disconnect = vi.fn();
    const limiter = {
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: vi.fn(),
      disconnect,
    } as unknown as DynamicsCompressorNode;
    limiters.push(limiter);
    limiterDisconnects.push(disconnect);
    return limiter;
  });
  const context = {
    currentTime: 12,
    createDynamicsCompressor,
    destination: {} as AudioDestinationNode,
  } as unknown as AudioContext;
  const controllers: FakeController[] = [new FakeController(context)];
  let currentController: FakeController | null = controllers[0];
  const setPattern = vi.fn(() => Promise.resolve());
  const replStop = vi.fn();
  const repl = {
    scheduler: { now: vi.fn(() => 0) },
    setCps: vi.fn(),
    setPattern,
    stop: replStop,
  };
  const defaultPrebake = vi.fn(() => Promise.resolve());
  const initAudio = vi.fn(() => Promise.resolve());
  type AudioController = ReturnType<
    StrudelModule['getSuperdoughAudioController']
  >;
  const setSuperdoughAudioController = vi.fn(
    (controller: AudioController | null) => {
      currentController = controller as FakeController | null;
      return controller;
    },
  );
  const getSuperdoughAudioController = vi.fn(() => {
    if (!currentController) {
      currentController = new FakeController(context);
      controllers.push(currentController);
    }
    return currentController;
  });
  const webaudioRepl = vi.fn(() => repl);
  const module: StrudelModule = {
    defaultPrebake,
    getAudioContext: vi.fn(() => context),
    getSuperdoughAudioController,
    initAudio,
    pure: vi.fn(() => pattern),
    sequence: vi.fn(() => pattern),
    setSuperdoughAudioController,
    setTime: vi.fn(),
    slowcat: vi.fn(() => pattern),
    stack: vi.fn(() => pattern),
    silence: pattern,
    transpiler: vi.fn(),
    webaudioRepl,
  };
  const engine = new StrudelAudioEngine(() => module);
  return {
    controllers,
    defaultPrebake,
    engine,
    initAudio,
    limiters,
    limiterDisconnects,
    module,
    replStop,
    setPattern,
    setSuperdoughAudioController,
    webaudioRepl,
  };
}

describe('StrudelAudioEngine', () => {
  it('initializes the complete audio engine on the first play', async () => {
    const { defaultPrebake, engine, initAudio, setPattern, webaudioRepl } =
      setup();

    await engine.play(compiled('founder-001'));

    expect(webaudioRepl).toHaveBeenCalledOnce();
    expect(defaultPrebake).toHaveBeenCalledOnce();
    expect(initAudio).toHaveBeenCalledWith({ maxPolyphony: 48 });
    expect(setPattern).toHaveBeenCalledOnce();
  });

  it('isolates consecutive previews in separate output controllers', async () => {
    const {
      controllers,
      engine,
      initAudio,
      limiters,
      limiterDisconnects,
      replStop,
      setPattern,
      setSuperdoughAudioController,
    } = setup();

    await engine.play(compiled('founder-001'));
    const firstPlayback = controllers[1];
    engine.stop();
    await engine.play(compiled('founder-002'));

    expect(initAudio).toHaveBeenCalledOnce();
    expect(setPattern).toHaveBeenCalledTimes(2);
    expect(setSuperdoughAudioController).toHaveBeenCalledTimes(2);
    expect(firstPlayback.setValueAtTime).toHaveBeenCalledWith(0, 12);
    expect(firstPlayback.destinationConnect).toHaveBeenCalledWith(limiters[0]);
    expect(firstPlayback.orbitDisconnect).toHaveBeenCalledOnce();
    expect(firstPlayback.busDisconnect).toHaveBeenCalledOnce();
    expect(firstPlayback.outputDisconnect).toHaveBeenCalledOnce();
    expect(limiterDisconnects[0]).toHaveBeenCalledOnce();
    expect(replStop).toHaveBeenCalledTimes(2);
  });

  it('retires a stopped generation only once', async () => {
    const { controllers, engine } = setup();
    await engine.play(compiled('founder-001'));
    const playback = controllers[1];

    engine.stop();
    engine.stop();

    expect(playback.outputDisconnect).toHaveBeenCalledOnce();
    expect(playback.setValueAtTime).toHaveBeenCalledTimes(2);
    expect(playback.setValueAtTime).toHaveBeenNthCalledWith(1, 0.78, 12);
    expect(playback.setValueAtTime).toHaveBeenNthCalledWith(2, 0, 12);
  });
});
