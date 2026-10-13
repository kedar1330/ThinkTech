// @vitest-environment jsdom
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormMessage } from '@/components/auth/shared';
import { CityCombobox } from '@/components/ui/city-combobox';
import { OtpInput } from '@/components/ui/otp-input';
import { PasswordChecklist } from '@/components/ui/password-checklist';
import { PasswordInput } from '@/components/ui/password-input';

function Otp({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <p id="otp-label">Code</p>
      <OtpInput name="otp" value={value} onChange={setValue} labelledBy="otp-label" />
      <output data-testid="value">{value}</output>
    </form>
  );
}

describe('OTP boxes (D-89)', () => {
  it('six labelled boxes; typing moves focus forward; never submits by itself', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Otp onSubmit={onSubmit} />);
    const boxes = screen.getAllByRole('textbox');
    expect(boxes).toHaveLength(6);
    expect(boxes[0]).toHaveAccessibleName('Digit 1 of 6');
    expect(screen.getByRole('group')).toHaveAccessibleName('Code');

    await user.click(boxes[0]!);
    await user.keyboard('123456');
    expect(screen.getByTestId('value')).toHaveTextContent('123456');
    expect(boxes[5]).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('pasting a full code fills every box; letters are ignored', async () => {
    const user = userEvent.setup();
    render(<Otp />);
    const boxes = screen.getAllByRole('textbox');
    await user.click(boxes[0]!);
    await user.paste('98 76-54');
    expect(screen.getByTestId('value')).toHaveTextContent('987654');
    expect(boxes.map((b) => (b as HTMLInputElement).value)).toEqual(['9', '8', '7', '6', '5', '4']);
    await user.click(boxes[2]!);
    await user.keyboard('a');
    expect((boxes[2] as HTMLInputElement).value).toBe('7');
  });

  it('Backspace on an empty box clears the previous one; arrow keys move between boxes', async () => {
    const user = userEvent.setup();
    render(<Otp />);
    const boxes = screen.getAllByRole('textbox');
    await user.click(boxes[0]!);
    await user.keyboard('12');
    expect(boxes[2]).toHaveFocus();
    await user.keyboard('{Backspace}');
    expect(boxes[1]).toHaveFocus();
    expect(screen.getByTestId('value')).toHaveTextContent('1');
    await user.keyboard('{ArrowLeft}');
    expect(boxes[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(boxes[1]).toHaveFocus();
  });
});

describe('password fields (D-87)', () => {
  it('the eye button toggles visibility and announces its state', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="pw">Password</label>
        <PasswordInput id="pw" defaultValue="Secret-1!" />
      </>,
    );
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('the checklist reports each rule live, with no strength label', () => {
    const { rerender } = render(<PasswordChecklist password="abc" />);
    const list = screen.getByRole('list', { name: 'Password requirements' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(within(list).getByText(/One lower-case letter/)).toHaveTextContent('— met');
    expect(within(list).getByText(/At least 8 characters/)).toHaveTextContent('not met yet');
    rerender(<PasswordChecklist password="Correct-Horse-9" />);
    expect(within(list).getAllByText(/— met/)).toHaveLength(5);
    expect(screen.queryByText(/weak|strong|medium/i)).toBeNull();
  });
});

describe('city combobox', () => {
  it('filters as you type, is keyboard operable, and submits the city ID', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = render(
      <>
        <label htmlFor="city">City</label>
        <CityCombobox id="city" name="city" onSelect={onSelect} />
      </>,
    );
    const box = screen.getByRole('combobox', { name: 'City' });
    await user.type(box, 'beng');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Bengaluru');
    expect(box).toHaveAttribute('aria-activedescendant', options[0]!.id);
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('bengaluru');
    expect(box).toHaveValue('Bengaluru, Karnataka');
    expect(container.querySelector('input[type="hidden"][name="city"]')).toHaveValue('bengaluru');
    expect(screen.queryByRole('listbox')).toBeNull();

    // Editing the text clears the selection until a city is chosen again.
    await user.type(box, 'x');
    expect(container.querySelector('input[type="hidden"][name="city"]')).toHaveValue('');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    render(<CityCombobox id="city" name="city" />);
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.getByText(/No matching city/)).toBeInTheDocument();
  });
});

describe('form messages', () => {
  it('errors are announced and offer the right next step; success is polite', () => {
    const { rerender } = render(
      <FormMessage state={{ error: 'An account with this email already exists.', code: 'EMAIL_ALREADY_REGISTERED' }} />,
    );
    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    rerender(<FormMessage state={{ error: 'Email not registered.', code: 'EMAIL_NOT_REGISTERED' }} />);
    expect(within(screen.getByRole('alert')).getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/register',
    );
    rerender(<FormMessage state={{ error: 'Locked', code: 'OTP_LOCKED', retryAfterSeconds: 1800 }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Try again in about 30 min');
    rerender(<FormMessage state={{ success: 'Saved.' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
  });
});
