import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrudelAudioEngine } from '../audio/strudel/StrudelRuntime';
import { PlaybackController } from '../player/PlaybackController';
import { App } from './App';

function mockAudioEngine() {
  const play = vi
    .spyOn(StrudelAudioEngine.prototype, 'play')
    .mockResolvedValue();
  const stop = vi
    .spyOn(StrudelAudioEngine.prototype, 'stop')
    .mockImplementation(() => undefined);
  return { play, stop };
}

describe('App', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows Generation 0 and the looping 16-bar A/B form', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { name: 'REBUS EVOLUTION' }),
    ).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Generation' })).toHaveValue(
      '0',
    );
    expect(screen.getByText(/Founder 001 \/ 42/)).toBeVisible();
    expect(screen.getByText('A · bars 1–8')).toBeVisible();
    expect(screen.getByText('B · bars 9–16')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('0:00 / 0:32');
    expect(screen.getByRole('button', { name: 'Play loop' })).toBeVisible();
  });

  it('offers Generation 2 and stops playback when switching generations', () => {
    const stop = vi.spyOn(PlaybackController.prototype, 'stop');
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Generation' }), {
      target: { value: '1' },
    });
    expect(stop).toHaveBeenCalled();
    expect(screen.getByText(/Organism 001 \/ 42/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'gen1-001' })).toBeVisible();
    expect(screen.getByLabelText('Происхождение организма')).toHaveTextContent(
      'Origin: elite',
    );
    expect(screen.getByLabelText('Происхождение организма')).toHaveTextContent(
      'Preserved from: founder-004',
    );
    expect(
      screen.getByLabelText('Происхождение организма'),
    ).not.toHaveTextContent('Parent:');

    fireEvent.change(screen.getByRole('combobox', { name: 'Generation' }), {
      target: { value: '2' },
    });
    expect(stop).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Organism 001 \/ 42/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'gen2-001' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('idle');
  });

  it('keeps G0, G1 and G2 ratings separate and treats zero as rated', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '0: Нейтрально' }));
    expect(screen.getByLabelText('Прогресс оценивания')).toHaveTextContent(
      '1из 42 оценено',
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Generation' }), {
      target: { value: '1' },
    });
    expect(screen.getByLabelText('Прогресс оценивания')).toHaveTextContent(
      '0из 42 оценено',
    );
    fireEvent.click(screen.getByRole('button', { name: '1: Нравится' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next unrated' }));
    expect(screen.getByText(/Organism 002 \/ 42/)).toBeVisible();

    fireEvent.change(screen.getByRole('combobox', { name: 'Generation' }), {
      target: { value: '0' },
    });
    expect(screen.getByLabelText('Прогресс оценивания')).toHaveTextContent(
      '1из 42 оценено',
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Generation' }), {
      target: { value: '2' },
    });
    expect(screen.getByLabelText('Прогресс оценивания')).toHaveTextContent(
      '0из 42 оценено',
    );
    fireEvent.click(screen.getByRole('button', { name: '0: Нейтрально' }));
    expect(screen.getByLabelText('Прогресс оценивания')).toHaveTextContent(
      '1из 42 оценено',
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Generation' }), {
      target: { value: '1' },
    });
    expect(screen.getByLabelText('Прогресс оценивания')).toHaveTextContent(
      '1из 42 оценено',
    );
  });

  it('wraps navigation inside the active generation', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Generation' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '← Previous' }));
    expect(screen.getByText(/Organism 042 \/ 42/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('idle');
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText(/Organism 001 \/ 42/)).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('idle');
  });

  it('keeps playing across Next and starts the next organism at zero', async () => {
    const { play, stop } = mockAudioEngine();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play loop' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('playing'),
    );
    const stopsBeforeNext = stop.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));

    expect(screen.getByRole('heading', { name: 'founder-002' })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'playing · section A0:00 / 0:32',
      ),
    );
    expect(play).toHaveBeenCalledTimes(2);
    expect(play.mock.calls[1][0].genomeId).toBe('founder-002');
    expect(stop.mock.calls.length).toBeGreaterThan(stopsBeforeNext);
  });

  it('keeps playing across Previous and wraps to the last organism', async () => {
    const { play, stop } = mockAudioEngine();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play loop' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('playing'),
    );
    const stopsBeforePrevious = stop.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: '← Previous' }));

    expect(screen.getByRole('heading', { name: 'founder-042' })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('playing'),
    );
    expect(play).toHaveBeenCalledTimes(2);
    expect(play.mock.calls[1][0].genomeId).toBe('founder-042');
    expect(stop.mock.calls.length).toBeGreaterThan(stopsBeforePrevious);
  });

  it('keeps stopped across Next and Previous without hidden autoplay', () => {
    const { play } = mockAudioEngine();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByRole('status')).toHaveTextContent('stopped');

    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByRole('heading', { name: 'founder-002' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('stopped');

    fireEvent.click(screen.getByRole('button', { name: '← Previous' }));
    expect(screen.getByRole('heading', { name: 'founder-001' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('stopped');
    expect(play).not.toHaveBeenCalled();
  });

  it('wraps Next from the last organism and preserves stopped state', () => {
    const { play } = mockAudioEngine();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '← Previous' }));
    expect(screen.getByRole('heading', { name: 'founder-042' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));

    expect(screen.getByRole('heading', { name: 'founder-001' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('stopped');
    expect(play).not.toHaveBeenCalled();
  });

  it('cancels rapid navigation plays so only the final organism remains active', async () => {
    let resolveNext: (() => void) | undefined;
    let resolvePrevious: (() => void) | undefined;
    const play = vi
      .spyOn(StrudelAudioEngine.prototype, 'play')
      .mockResolvedValueOnce()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveNext = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolvePrevious = resolve;
          }),
      );
    vi.spyOn(StrudelAudioEngine.prototype, 'stop').mockImplementation(
      () => undefined,
    );
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play loop' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('playing'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    fireEvent.click(screen.getByRole('button', { name: '← Previous' }));
    expect(screen.getByRole('heading', { name: 'founder-001' })).toBeVisible();
    expect(play.mock.calls.map(([pattern]) => pattern.genomeId)).toEqual([
      'founder-001',
      'founder-002',
      'founder-001',
    ]);

    await act(async () => {
      resolveNext?.();
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('loading');

    await act(async () => {
      resolvePrevious?.();
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'playing · section A0:00 / 0:32',
    );
  });
});
