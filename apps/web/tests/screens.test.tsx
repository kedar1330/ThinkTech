// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAFT_KEY, serializeDraft } from '@/lib/auth/draft';

// Server actions and routing are mocked: these tests cover the browser-side behaviour only.
const actions = vi.hoisted(() => ({
  registerAction: vi.fn(async () => undefined),
  loginAction: vi.fn(async () => undefined),
  logoutAction: vi.fn(async () => undefined),
  sendDeletionCodeAction: vi.fn(async () => ({ success: 'We sent a 6-digit code.', data: { sent: true } })),
  deleteAccountAction: vi.fn(async () => undefined),
}));
vi.mock('@/app/actions/auth', () => ({
  registerAction: actions.registerAction,
  loginAction: actions.loginAction,
  logoutAction: actions.logoutAction,
}));
vi.mock('@/app/actions/account', () => ({
  sendDeletionCodeAction: actions.sendDeletionCodeAction,
  deleteAccountAction: actions.deleteAccountAction,
  changePasswordAction: vi.fn(),
  removePhoneAction: vi.fn(),
  sendPasswordChangeCodeAction: vi.fn(),
  startEmailChangeAction: vi.fn(),
  startPhoneAction: vi.fn(),
  updateDetailsAction: vi.fn(),
  verifyEmailChangeAction: vi.fn(),
  verifyPhoneAction: vi.fn(),
}));
const nav = vi.hoisted(() => ({ pathname: '/home' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { AppShell } from '@/components/app/AppShell';
import { DeleteAccountForm } from '@/components/app/SettingsForms';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { SiteHeader } from '@/components/site/SiteHeader';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('registration form (D-87)', () => {
  it('has the required fields in order, optional phone, consent unchecked, Remember Me off', () => {
    render(<RegisterForm googleEnabled />);
    for (const label of ['Full name', 'Email', 'Password', 'Confirm password', 'City']) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(screen.getByLabelText(/Mobile number/)).not.toBeRequired();
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Terms of Service/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /style tips/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Remember me/ })).not.toBeChecked();
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeEnabled();
    expect(screen.getByRole('separator')).toHaveTextContent(/or/i);
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('Google sign-up stays disabled until the terms are accepted, then carries the choices', async () => {
    const user = userEvent.setup();
    render(<RegisterForm googleEnabled />);
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeDisabled();
    expect(screen.getByText(/Accept the Terms of Service and Privacy Policy above/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Terms of Service/ }));
    await user.click(screen.getByRole('checkbox', { name: /Remember me/ }));
    expect(screen.getByRole('link', { name: /Continue with Google/ })).toHaveAttribute(
      'href',
      '/api/oauth/google/start?intent=signup&terms=1&remember=1&marketing=0',
    );
  });

  it('keeps a 24-hour draft of non-sensitive fields only, and restores it', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<RegisterForm googleEnabled={false} />);
    await user.type(screen.getByLabelText('Full name'), 'Asha Rao');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'Secret-Pass-1!');
    await user.type(screen.getByLabelText('Confirm password'), 'Secret-Pass-1!');
    await user.click(screen.getByRole('checkbox', { name: /Terms of Service/ }));
    const stored = window.localStorage.getItem(DRAFT_KEY) ?? '';
    expect(stored).toContain('asha@example.com');
    expect(stored).not.toContain('Secret-Pass-1!');
    expect(stored).not.toMatch(/password|acceptTerms/i);
    unmount();

    render(<RegisterForm googleEnabled={false} />);
    await waitFor(() => expect(screen.getByLabelText('Full name')).toHaveValue('Asha Rao'));
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /Terms of Service/ })).not.toBeChecked();
  });

  it('ignores an expired draft', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      serializeDraft(
        { fullName: 'Old', email: 'old@example.com', city: '', phone: '', marketingOptIn: false, rememberMe: false },
        Date.now() - 25 * 60 * 60 * 1000,
      ),
    );
    render(<RegisterForm googleEnabled={false} />);
    await act(async () => {});
    expect(screen.getByLabelText('Full name')).toHaveValue('');
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('shows a mismatch as soon as the confirmation differs', async () => {
    const user = userEvent.setup();
    render(<RegisterForm googleEnabled={false} />);
    await user.type(screen.getByLabelText('Password'), 'Secret-Pass-1!');
    await user.type(screen.getByLabelText('Confirm password'), 'Secret-Pass-2!');
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('login form', () => {
  it('email + password with show/hide, Remember Me off, Forgot Password and Sign up links', () => {
    render(<LoginForm googleEnabled={false} />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Remember me/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
    expect(screen.getByText('Google login is not available yet.')).toBeInTheDocument();
  });
});

describe('public navigation', () => {
  it('desktop links and a hamburger menu that opens, closes and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<SiteHeader />);
    const main = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Home', 'How It Works', 'Features', 'About']) {
      expect(within(main).getByRole('link', { name })).toBeInTheDocument();
    }
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('mobile-menu')).not.toBeVisible();
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('mobile-menu')).toBeVisible();
    expect(within(document.getElementById('mobile-menu')!).getByRole('link', { name: 'Sign Up' })).toHaveAttribute(
      'href',
      '/register',
    );
    await user.keyboard('{Escape}');
    expect(document.getElementById('mobile-menu')).not.toBeVisible();
  });
});

describe('app top navigation', () => {
  beforeEach(() => {
    nav.pathname = '/home';
  });

  it('keeps all nine sections reachable: the first in the bar, the rest under More (with Coming soon)', async () => {
    const user = userEvent.setup();
    render(
      <AppShell userName="Asha Rao" userEmail="asha@example.com">
        content
      </AppShell>,
    );
    const bar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(bar).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).getByRole('link', { name: 'Discover My Style' })).toHaveAttribute('href', '/discover/looks');

    const more = within(bar).getByRole('button', { name: /More/ });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    const menu = document.getElementById('nav-more')!;
    for (const name of [
      'My Colour Palette',
      'Outfit Categories',
      'Shop My Look',
      'Virtual Try-On',
      'Design Studio',
      'Style Assistant',
    ]) {
      expect(within(menu).getByRole('link', { name: new RegExp(name) })).toHaveTextContent('Coming soon');
    }
    expect(within(menu).getByRole('link', { name: 'Saved Outfits' })).toHaveAttribute('href', '/saved');
    await user.keyboard('{Escape}');
    expect(document.getElementById('nav-more')).toBeNull();
    expect(more).toHaveFocus();
  });

  it('marks More as active when the current page is inside it', () => {
    nav.pathname = '/features/design-studio';
    render(
      <AppShell userName="Asha" userEmail="asha@example.com">
        content
      </AppShell>,
    );
    expect(screen.getByRole('button', { name: /More/ }).className).toContain('text-accent');
  });

  it('profile menu: name, email, Settings and Log out; closes on Escape and on an outside click', async () => {
    const user = userEvent.setup();
    render(
      <AppShell userName="Asha Rao" userEmail="asha@example.com">
        content
      </AppShell>,
    );
    const button = screen.getByRole('button', { name: /Account menu for Asha Rao/ });
    await user.click(button);
    const menu = document.getElementById('profile-menu')!;
    expect(menu).toHaveTextContent('asha@example.com');
    expect(within(menu).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(within(menu).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(document.getElementById('profile-menu')).toBeNull();
    expect(button).toHaveFocus();
    await user.click(button);
    await user.click(screen.getByText('content'));
    expect(document.getElementById('profile-menu')).toBeNull();
  });

  it('mobile drawer: all nine sections, focus moves in, background scroll locks, Escape closes', async () => {
    const user = userEvent.setup();
    render(
      <AppShell userName="Asha" userEmail="asha@example.com">
        content
      </AppShell>,
    );
    const open = screen.getByRole('button', { name: 'Open menu' });
    await user.click(open);
    const drawer = screen.getByRole('dialog', { name: 'Menu' });
    expect(
      within(drawer)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('href') !== '/settings'),
    ).toHaveLength(
      // nine sections + the logo
      10,
    );
    expect(within(drawer).getByRole('link', { name: /Style Assistant/ })).toHaveTextContent('Coming soon');
    expect(within(drawer).getByRole('link', { name: 'Saved Outfits' })).toHaveAttribute('href', '/saved');
    expect(within(drawer).getByRole('button', { name: 'Close menu' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(drawer).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(open).toHaveFocus();
  });
});

describe('account deletion (D-94)', () => {
  it('needs the emailed code, the acknowledgement and a separate confirmation before anything is sent', async () => {
    const user = userEvent.setup();
    render(<DeleteAccountForm />);
    await user.click(screen.getByRole('button', { name: 'Email me a deletion code' }));
    await waitFor(() => expect(actions.sendDeletionCodeAction).toHaveBeenCalled());

    const submit = await screen.findByRole('button', { name: 'Delete my account…' });
    expect(submit).toBeDisabled();
    await user.click(screen.getAllByRole('textbox')[0]!);
    await user.paste('123456');
    expect(submit).toBeDisabled(); // acknowledgement still missing
    await user.click(screen.getByRole('checkbox', { name: /deleted permanently/ }));
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(actions.deleteAccountAction).not.toHaveBeenCalled();
    const confirm = await screen.findByRole('dialog', { name: 'Delete your account permanently?' });
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(actions.deleteAccountAction).not.toHaveBeenCalled();

    await user.click(submit);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(actions.deleteAccountAction).toHaveBeenCalledTimes(1));
    const formData = (actions.deleteAccountAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(formData.get('otp')).toBe('123456');
    expect(formData.get('confirm')).toBe('on');
  });
});
