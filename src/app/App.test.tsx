import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the application identity and loaded state', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'REBUS EVOLUTION' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Application loaded');
  });
});
