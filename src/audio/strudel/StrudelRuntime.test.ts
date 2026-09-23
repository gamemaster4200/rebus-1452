import { describe, expect, it, vi } from 'vitest';
import type { CompiledStrudelPattern } from './CompiledStrudelPattern';
import { StrudelAudioEngine, type StrudelModule } from './StrudelRuntime';

const pattern = { _Pattern: true as const };

function compiled(genomeId: string): CompiledStrudelPattern {
  return {
    compilerVersion: 'strudel-compiler-v1',
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

function setup() {
  const resetGlobalEffects = vi.fn();
  const replStop = vi.fn();
  const setPattern = vi.fn(() => Promise.resolve());
  const initStrudel = vi.fn(() =>
    Promise.resolve({ setCps: vi.fn(), setPattern, stop: replStop }),
  );
  const module: StrudelModule = {
    initStrudel,
    resetGlobalEffects,
    pure: vi.fn(() => pattern),
    sequence: vi.fn(() => pattern),
    stack: vi.fn(() => pattern),
    slowcat: vi.fn(() => pattern),
    silence: pattern,
    setMaxPolyphony: vi.fn(),
  };
  const engine = new StrudelAudioEngine(() => Promise.resolve(module));
  return { engine, initStrudel, replStop, resetGlobalEffects, setPattern };
}

describe('StrudelAudioEngine', () => {
  it('disconnects the old output graph before the next preview', async () => {
    const { engine, initStrudel, replStop, resetGlobalEffects, setPattern } =
      setup();
    await engine.play(compiled('founder-001'));
    engine.stop();
    await engine.play(compiled('founder-002'));

    expect(initStrudel).toHaveBeenCalledOnce();
    expect(setPattern).toHaveBeenCalledTimes(2);
    expect(replStop).toHaveBeenCalledTimes(2);
    expect(resetGlobalEffects).toHaveBeenCalledTimes(2);
  });

  it('resets effects for stop and restart without rebuilding Strudel', async () => {
    const { engine, initStrudel, resetGlobalEffects } = setup();
    await engine.play(compiled('founder-001'));
    engine.stop();
    await engine.play(compiled('founder-001'));

    expect(initStrudel).toHaveBeenCalledOnce();
    expect(resetGlobalEffects).toHaveBeenCalledTimes(2);
  });
});
