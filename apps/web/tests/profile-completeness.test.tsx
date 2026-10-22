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
  ageGroup: null,
  heightCm: null,
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

const attr = <T,>(value: T) => ({
  value,
  source: 'self_reported' as const,
  userConfirmed: true,
  confirmedAt: '2026-10-22T10:00:00.000Z',
  estimate: null,
});
const NO_APPEARANCE = { skinTone: null, undertone: null, bodyType: null };

describe('Complete your profile card (D-129)', () => {
  it('after skipping: lists every missing item with a link to where it is added', () => {
    render(<ProfileCompletenessCard completeness={profileCompleteness(EMPTY, { city: null }, NO_APPEARANCE)} />);
    const card = screen.getByRole('region', { name: 'Complete your profile' });
    expect(card).toHaveTextContent('0 of 5 done');
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(within(card).getByRole('link', { name: /City/ })).toHaveAttribute('href', '/settings#details');
    expect(within(card).getByRole('link', { name: /Clothing preference/ })).toHaveAttribute('href', '/profile#basics');
    expect(within(card).getByRole('link', { name: /Height/ })).toHaveAttribute('href', '/profile#basics');
    expect(within(card).getByRole('link', { name: /Skin tone/ })).toHaveAttribute('href', '/profile#skin-tone');
    expect(within(card).getByRole('link', { name: /Body type/ })).toHaveAttribute('href', '/profile#body-type');
    expect(within(card).getByRole('link', { name: /Complete my profile/ })).toHaveAttribute('href', '/profile#basics');
  });

  it('shows only what is missing for a partial profile', () => {
    const partial = { ...EMPTY, department: 'women' as const };
    render(<ProfileCompletenessCard completeness={profileCompleteness(partial, { city: 'pune' }, NO_APPEARANCE)} />);
    const card = screen.getByRole('region', { name: 'Complete your profile' });
    expect(card).toHaveTextContent('2 of 5 done');
    expect(within(card).queryByRole('link', { name: /Clothing preference/ })).toBeNull();
    expect(within(card).queryByRole('link', { name: /^City/ })).toBeNull();
    expect(within(card).getByRole('link', { name: /Body type/ })).toBeInTheDocument();
  });

  it('renders nothing once the profile is complete', () => {
    const appearance = {
      skinTone: attr({ monkRange: '5-5' }),
      undertone: attr('warm' as const),
      bodyType: attr('rectangle' as const),
    };
    const { container } = render(
      <ProfileCompletenessCard
        completeness={profileCompleteness({ ...EMPTY, department: 'men', heightCm: 178 }, { city: 'pune' }, appearance)}
      />,
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
    ).toHaveAttribute('href', '/profile#basics');
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
