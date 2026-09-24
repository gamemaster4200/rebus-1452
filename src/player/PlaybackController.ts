import type { CompiledAudioEngine } from '../audio/strudel/StrudelRuntime';
import type { CompiledStrudelPattern } from '../audio/strudel/CompiledStrudelPattern';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'stopped';

export interface PlaybackState {
  readonly status: PlaybackStatus;
  readonly elapsedMs: number;
  readonly totalMs: number;
  readonly section: 'A' | 'B';
}

export interface PlaybackScheduler {
  now(): number;
  setInterval(callback: () => void, delayMs: number): number;
  clearInterval(id: number): void;
}

export const browserPlaybackScheduler: PlaybackScheduler = {
  now: () => performance.now(),
  setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
  clearInterval: (id) => window.clearInterval(id),
};

type PlaybackListener = (state: PlaybackState) => void;

export class PlaybackController {
  private selected: CompiledStrudelPattern | null = null;
  private state: PlaybackState = {
    status: 'idle',
    elapsedMs: 0,
    totalMs: 32_000,
    section: 'A',
  };
  private readonly listeners = new Set<PlaybackListener>();
  private startedAt = 0;
  private tickTimer: number | null = null;
  private operation = 0;

  constructor(
    private readonly engine: CompiledAudioEngine,
    private readonly scheduler: PlaybackScheduler = browserPlaybackScheduler,
  ) {}

  getState(): PlaybackState {
    return this.state;
  }

  subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  select(
    compiled: CompiledStrudelPattern,
    selectedStatus: Extract<PlaybackStatus, 'idle' | 'stopped'> = 'idle',
  ): void {
    this.operation += 1;
    this.stopTimers();
    this.engine.stop();
    this.selected = compiled;
    this.publish({
      status: selectedStatus,
      elapsedMs: 0,
      totalMs: compiled.durationSeconds * 1_000,
      section: 'A',
    });
  }

  async play(): Promise<void> {
    const compiled = this.selected;
    if (!compiled) throw new Error('Select a compiled genome before playback.');

    const operation = ++this.operation;
    this.stopTimers();
    this.engine.stop();
    this.publish({
      ...this.state,
      status: 'loading',
      elapsedMs: 0,
      section: 'A',
    });
    await this.engine.play(compiled);

    if (operation !== this.operation || compiled !== this.selected) {
      return;
    }

    this.startedAt = this.scheduler.now();
    this.publish({
      ...this.state,
      status: 'playing',
      elapsedMs: 0,
      section: 'A',
    });
    this.tickTimer = this.scheduler.setInterval(() => this.tick(), 100);
  }

  async restart(): Promise<void> {
    this.stop();
    await this.play();
  }

  stop(): void {
    this.operation += 1;
    this.stopTimers();
    this.engine.stop();
    this.publish({
      ...this.state,
      status: 'stopped',
      elapsedMs: 0,
      section: 'A',
    });
  }

  dispose(): void {
    this.operation += 1;
    this.stopTimers();
    this.engine.stop();
    this.listeners.clear();
  }

  private tick(): void {
    const elapsedMs =
      Math.max(0, this.scheduler.now() - this.startedAt) % this.state.totalMs;
    this.publish({
      ...this.state,
      elapsedMs,
      section: elapsedMs >= this.state.totalMs / 2 ? 'B' : 'A',
    });
  }

  private stopTimers(): void {
    if (this.tickTimer !== null) this.scheduler.clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  private publish(state: PlaybackState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener(state));
  }
}
