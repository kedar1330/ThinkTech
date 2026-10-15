// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { profileCompleteness, type ProfileResponse } from '@styleme/contracts';

const onboarding = vi.hoisted(() => ({ skip: vi.fn(async () => undefined) }));
vi.mock('@/app/actions/onboarding', () => ({
  completeAppearanceAction: vi.fn(),
  completeStyleProfileAction: vi.fn(),
  setupPasswordAction: vi.fn(),
  skipOnboardingAction: onboarding.skip,
}));
vi.mock('@/app/actions/auth', () => ({ logoutAction: vi.fn() }));
vi.mock('@/app/actions/profile', () => ({ saveProfileAction: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/home' }));

import { AppShell } from '@/components/app/AppShell';
import { SkipStyleProfile } from '@/components/app/OnboardingForms';
import { ProfileCompletenessCard } from '@/components/app/ProfileCompleteness';

const EMPTY: ProfileResponse = {
  department: null,
  sizes: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null },
  fitPreferences: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null },
  likedColors: [],
  dislikedColors: [],
  contrastPreference: null,
  silhouettePreferences: [],
  coveragePreferences: { minSleeveLength: null, minNecklineCoverage: null, minGarmentLength: null },
  comfortPreferences: [],
  fabricPreferences: { liked: [], avoided: [] },
  preferredStyles: [],
  preferredOccasions: [],
  budgetPreference: null,
  updatedAt: null,
};

describe('Skip for now (onboarding)', () => {
  it('offers Skip for now, which calls the skip action', async () => {
    const user = userEvent.setup();
    render(<SkipStyleProfile />);
    expect(screen.getByText(/finish your profile anytime/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(onboarding.skip).toHaveBeenCalledTimes(1);
  });
});

describe('Complete your profile card', () => {
  it('after skipping: lists every missing item with a link to where it is added', () => {
    render(<ProfileCompletenessCard completeness={profileCompleteness(EMPTY, { city: null })} />);
    const card = screen.getByRole('region', { name: 'Complete your profile' });
    expect(card).toHaveTextContent('0 of 7 done');
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(within(card).getByRole('link', { name: /City/ })).toHaveAttribute('href', '/settings#details');
    expect(within(card).getByRole('link', { name: /Department/ })).toHaveAttribute('href', '/profile#style-profile');
    expect(within(card).getByRole('link', { name: /Complete my profile/ })).toHaveAttribute(
      'href',
      '/profile#style-profile',
    );
  });

  it('shows only what is missing for a partial profile', () => {
    const partial = { ...EMPTY, department: 'women' as const, likedColors: ['navy' as const] };
    render(<ProfileCompletenessCard completeness={profileCompleteness(partial, { city: 'pune' })} />);
    const card = screen.getByRole('region', { name: 'Complete your profile' });
    expect(card).toHaveTextContent('3 of 7 done');
    expect(within(card).queryByRole('link', { name: /Department/ })).toBeNull();
    expect(within(card).queryByRole('link', { name: /^City/ })).toBeNull();
    expect(within(card).getByRole('link', { name: /Budget per look/ })).toBeInTheDocument();
  });

  it('renders nothing once the profile is complete', () => {
    const full: ProfileResponse = {
      ...EMPTY,
      department: 'men',
      sizes: { ...EMPTY.sizes, shoes: { uk: 9 } as never },
      likedColors: ['navy'],
      preferredOccasions: ['work'],
      preferredStyles: ['classic'],
      budgetPreference: 3000,
    };
    const { container } = render(
      <ProfileCompletenessCard completeness={profileCompleteness(full, { city: 'pune' })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('navigation hint for an incomplete profile', () => {
  it('adds a dot on the avatar and "Complete your profile" to the account menu and drawer', async () => {
    const user = userEvent.setup();
    render(
      <AppShell userName="Asha" userEmail="asha@example.com" profileIncomplete>
        content
      </AppShell>,
    );
    expect(screen.getByTestId('profile-incomplete-dot')).toBeInTheDocument();
    const account = screen.getByRole('button', { name: /Account menu for Asha \(profile incomplete\)/ });
    await user.click(account);
    expect(
      within(document.getElementById('profile-menu')!).getByRole('link', { name: 'Complete your profile' }),
    ).toHaveAttribute('href', '/profile#style-profile');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(
      within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('link', { name: 'Complete your profile' }),
    ).toBeInTheDocument();
  });

  it('shows no hint when the profile is complete', async () => {
    const user = userEvent.setup();
    render(
      <AppShell userName="Asha" userEmail="asha@example.com">
        content
      </AppShell>,
    );
    expect(screen.queryByTestId('profile-incomplete-dot')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Account menu for Asha/ }));
    expect(screen.queryByRole('link', { name: 'Complete your profile' })).toBeNull();
  });
});
