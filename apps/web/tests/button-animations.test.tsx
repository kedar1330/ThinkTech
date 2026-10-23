// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { ArrowRight } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';

// Button animations (#139): press, lift, shine and icon nudge, motion-safe only; text links stay calm.

const LIFT = 'motion-safe:hover:-translate-y-px';
const PRESS = 'motion-safe:active:scale-[0.97]';

describe('Button animations', () => {
  it('primary and accent buttons press, lift and shine', () => {
    for (const variant of ['default', 'accent'] as const) {
      render(<Button variant={variant}>{variant}</Button>);
      const button = screen.getByRole('button', { name: variant });
      expect(button).toHaveClass('btn-shine', LIFT, PRESS, 'relative', 'isolate', 'overflow-hidden');
    }
  });

  it('destructive and outline buttons press and lift without the shine', () => {
    for (const variant of ['destructive', 'outline'] as const) {
      render(<Button variant={variant}>{variant}</Button>);
      const button = screen.getByRole('button', { name: variant });
      expect(button).toHaveClass(LIFT, PRESS);
      expect(button).not.toHaveClass('btn-shine');
    }
  });

  it('ghost buttons only press, and text links stay calm', () => {
    render(<Button variant="ghost">ghost</Button>);
    expect(screen.getByRole('button', { name: 'ghost' })).toHaveClass(PRESS);
    expect(screen.getByRole('button', { name: 'ghost' })).not.toHaveClass(LIFT, 'btn-shine');

    render(<Button variant="link">link</Button>);
    const link = screen.getByRole('button', { name: 'link' });
    expect(link).toHaveClass('motion-safe:active:scale-100');
    expect(link).not.toHaveClass(PRESS, LIFT, 'btn-shine');
  });

  it('only moves with motion allowed, and eases colour, shadow and movement together', () => {
    render(<Button>Go</Button>);
    const button = screen.getByRole('button', { name: 'Go' });
    const motionClasses = button.className
      .split(' ')
      .filter((c) => /translate|scale/.test(c) && !c.startsWith('transition') && !c.includes(':transition'));
    expect(motionClasses.length).toBeGreaterThan(0);
    for (const c of motionClasses) expect(c.startsWith('motion-safe:')).toBe(true);
    expect(button).toHaveClass('transition-[color,background-color,border-color,box-shadow,translate,scale]');
  });

  it('keeps sizes, the disabled state and links styled as buttons', () => {
    render(
      <Button size="sm" disabled>
        Saving
      </Button>,
    );
    const disabled = screen.getByRole('button', { name: 'Saving' });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveClass('h-9', 'px-4', 'disabled:pointer-events-none');

    render(
      <Button asChild>
        <a href="/discover">
          Discover <ArrowRight />
        </a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Discover' });
    expect(link).toHaveClass('btn-shine', LIFT);
    expect(link.className).toContain('motion-safe:hover:[&>svg:last-child:not(:first-child)]:translate-x-0.5');
  });
});
