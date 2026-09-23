import { describe, expect, it, vi } from 'vitest';
import type { CompiledAudioEngine } from '../audio/strudel/StrudelRuntime';
import type { CompiledStrudelPattern } from '../audio/strudel/CompiledStrudelPattern';
import {
  PlaybackController,
  type PlaybackScheduler,
} from './PlaybackController';

class FakeScheduler implements PlaybackScheduler {
  private time = 0;
  private nextId = 1;
  private tasks = new Map<
    number,
    { callback: () => void; at: number; interval: number | null }
  >();

  now(): number {
    return this.time;
  }

  setInterval(callback: () => void, delayMs: number): number {
    return this.add(callback, delayMs, delayMs);
  }

  clearInterval(id: number): void {
    this.tasks.delete(id);
  }

  advanceBy(durationMs: number): void {
    const target = this.time + durationMs;
    while (true) {
      const pending = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!pending) break;
      const [id, task] = pending;
      this.time = task.at;
      if (task.interval === null) this.tasks.delete(id);
      else task.at += task.interval;
      task.callback();
    }
    this.time = target;
  }

  private add(
    callback: () => void,
    delayMs: number,
    interval: number | null,
  ): number {
    const id = this.nextId++;
    this.tasks.set(id, { callback, at: this.time + delayMs, interval });
    return id;
  }
}

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

function setup() {
  const scheduler = new FakeScheduler();
  const play = vi.fn(() => Promise.resolve());
  const stop = vi.fn();
  const engine: CompiledAudioEngine = {
    play,
    stop,
  };
  const controller = new PlaybackController(engine, scheduler);
  return { controller, play, scheduler, stop };
}

describe('PlaybackController', () => {
  it('tracks the A/B boundary and loops after exactly 32 seconds', async () => {
    const { controller, scheduler, stop } = setup();
    controller.select(compiled('founder-001'));
    await controller.play();

    scheduler.advanceBy(15_900);
    expect(controller.getState()).toMatchObject({
      status: 'playing',
      section: 'A',
    });

    scheduler.advanceBy(100);
    expect(controller.getState()).toMatchObject({
      status: 'playing',
      elapsedMs: 16_000,
      section: 'B',
    });

    scheduler.advanceBy(16_000);
    expect(controller.getState()).toEqual({
      status: 'playing',
      elapsedMs: 0,
      totalMs: 32_000,
      section: 'A',
    });
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('stops the previous pattern when the founder changes', async () => {
    const { controller, stop } = setup();
    controller.select(compiled('founder-001'));
    await controller.play();
    controller.select(compiled('founder-002'));

    expect(stop).toHaveBeenCalledTimes(3);
    expect(controller.getState()).toMatchObject({
      status: 'idle',
      elapsedMs: 0,
    });
  });

  it('can stop and restart from the beginning', async () => {
    const { controller, play, scheduler } = setup();
    controller.select(compiled('founder-001'));
    await controller.play();
    scheduler.advanceBy(4_000);
    controller.stop();
    expect(controller.getState()).toMatchObject({
      status: 'stopped',
      elapsedMs: 0,
    });

    await controller.restart();
    expect(controller.getState()).toMatchObject({
      status: 'playing',
      elapsedMs: 0,
    });
    expect(play).toHaveBeenCalledTimes(2);
  });
});
