import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackController } from '../player/PlaybackController';
import { App } from './App';

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

  it('switches to Generation 1, stops playback, and shows lineage', () => {
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
  });

  it('keeps G0 and G1 ratings separate and treats zero as rated', () => {
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
  });

  it('wraps navigation inside the active generation', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Generation' }), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '← Previous' }));
    expect(screen.getByText(/Organism 042 \/ 42/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText(/Organism 001 \/ 42/)).toBeVisible();
  });
});
