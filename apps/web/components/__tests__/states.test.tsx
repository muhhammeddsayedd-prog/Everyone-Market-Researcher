import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HealthDots } from '../features/competitors/health-dots';
import { LogoTile } from '../ui/logo-tile';
import { StatusPill } from '../ui/status-pill';
import { EmptyState, UnavailablePanel } from '../ui/states';

describe('LogoTile', () => {
  it('shows the stored logo with the organisation name as alt text', () => {
    render(
      <LogoTile
        src="https://ref.supabase.co/storage/v1/object/public/media/logos/a.svg"
        name="Good People"
        size={64}
      />,
    );
    expect(screen.getByRole('img', { name: 'Good People' })).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('falls back to initials when the image fails, never a broken image', () => {
    render(
      <LogoTile
        src="https://ref.supabase.co/storage/v1/object/public/media/logos/a.svg"
        name="Good People"
        size={64}
      />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Good People' }));
    expect(screen.getByTestId('logo-initials')).toHaveTextContent('GP');
    expect(document.querySelector('img')).toBeNull();
  });

  it('uses initials when no logo is stored', () => {
    render(<LogoTile src={null} name="electriclime°" size={32} />);
    expect(screen.getByRole('img', { name: 'electriclime°' })).toHaveTextContent('EL');
  });
});

describe('status and health', () => {
  it('always pairs colour with text', () => {
    render(<StatusPill tone="danger" label="Failing" />);
    expect(screen.getByText('Failing')).toBeVisible();
  });

  it('gives each platform dot a text alternative', () => {
    render(
      <HealthDots
        health={[
          { family: 'vimeo', status: 'active' },
          { family: 'youtube', status: null },
        ]}
      />,
    );
    expect(screen.getByRole('list', { name: 'Source status by platform' })).toBeInTheDocument();
    expect(screen.getByText('Vimeo: Active')).toBeInTheDocument();
    expect(screen.getByText('YouTube: no source')).toBeInTheDocument();
  });
});

describe('empty and unavailable states', () => {
  it('explains what is missing instead of showing sample data', () => {
    render(
      <UnavailablePanel title="Team" reason="Nothing is shown until these records exist." dependency="M05" />,
    );
    expect(screen.getByRole('region', { name: 'Team' })).toHaveTextContent('Not available yet');
    expect(screen.getByText('Depends on: M05')).toBeVisible();
  });

  it('renders an empty state with an optional action', () => {
    render(
      <EmptyState
        title="No companies match these filters."
        action={<button type="button">Clear filters</button>}
      />,
    );
    expect(screen.getByText('No companies match these filters.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  });
});
