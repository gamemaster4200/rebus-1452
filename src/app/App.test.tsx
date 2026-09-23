import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it('shows the first founder and the fixed 32-second A/B form', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'REBUS EVOLUTION' }),
    ).toBeVisible();
    expect(screen.getByText(/Founder 001 \/ 42/)).toBeVisible();
    expect(screen.getByText('A · bars 1–8')).toBeVisible();
    expect(screen.getByText('B · bars 9–16')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('0:00 / 0:32');
  });

  it('persists a neutral rating and navigates to the next unrated founder', () => {
    const { unmount } = render(<App />);
    const neutral = screen.getByRole('button', { name: '0: Нейтрально' });
    fireEvent.click(neutral);

    expect(neutral).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Прогресс оценивания')).toHaveTextContent(
      '1из 42 оценено',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next unrated' }));
    expect(screen.getByText(/Founder 002 \/ 42/)).toBeVisible();

    unmount();
    render(<App />);
    expect(screen.getByLabelText('Прогресс оценивания')).toHaveTextContent(
      '1из 42 оценено',
    );
  });

  it('stops and wraps navigation between founders', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '← Previous' }));
    expect(screen.getByText(/Founder 042 \/ 42/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText(/Founder 001 \/ 42/)).toBeVisible();
  });
});
