// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileResponse } from '@styleme/contracts';

const actions = vi.hoisted(() => ({ requestLooksAction: vi.fn() }));
vi.mock('@/app/actions/discover', () => actions);

import { ProfileSummary } from '@/components/discover/ProfileSummary';
import { RequestForm } from '@/components/discover/RequestForm';

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

beforeEach(() => actions.requestLooksAction.mockReset());

describe('Discover My Style request form', () => {
  it('marks the occasion as required and every other field as optional', () => {
    render(<RequestForm sizes={EMPTY.sizes} />);
    const occasion = screen.getByRole('group', { name: 'Occasion (required)' });
    for (const radio of within(occasion).getAllByRole('radio')) expect(radio).toBeRequired();
    expect(screen.getByLabelText(/^Style/)).toHaveValue('');
    expect(screen.getByRole('radio', { name: /Suggested for me/ })).toBeChecked();
  });

  it('sends the chosen values to the action', async () => {
    actions.requestLooksAction.mockResolvedValue({ success: 'We found 3 looks for this request.' });
    const user = userEvent.setup();
    render(<RequestForm sizes={EMPTY.sizes} />);
    await user.click(screen.getByRole('radio', { name: 'Festive' }));
    await user.selectOptions(screen.getByLabelText(/^Style/), 'fusion');
    await user.click(screen.getByRole('checkbox', { name: 'Indian' }));
    await user.click(screen.getByRole('radio', { name: /Explore/ }));
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));

    const formData = actions.requestLooksAction.mock.calls[0]![1] as FormData;
    expect(formData.get('occasion')).toBe('festive');
    expect(formData.get('style')).toBe('fusion');
    expect(formData.getAll('wearType')).toEqual(['indian']);
    expect(formData.get('paletteMode')).toBe('explore');
    expect(await screen.findByRole('status')).toHaveTextContent('We found 3 looks');
  });

  it('shows field errors returned by the action', async () => {
    actions.requestLooksAction.mockResolvedValue({
      error: 'Please check the highlighted fields.',
      fieldErrors: { occasion: 'Choose an occasion.' },
    });
    const user = userEvent.setup();
    render(<RequestForm sizes={EMPTY.sizes} />);
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please check the highlighted fields.');
    expect(screen.getByRole('group', { name: 'Occasion (required)' })).toHaveAccessibleDescription(
      'Choose an occasion.',
    );
    expect(screen.getByRole('radio', { name: 'Work' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables the submit button while the request is sending', async () => {
    let finish: (state: { success: string }) => void = () => {};
    actions.requestLooksAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<RequestForm sizes={EMPTY.sizes} />);
    await user.click(screen.getByRole('radio', { name: 'Work' }));
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));
    expect(await screen.findByRole('button', { name: /Finding looks/ })).toBeDisabled();

    finish({ success: 'Done.' });
    expect(await screen.findByRole('button', { name: 'Show me looks' })).toBeEnabled();
  });

  it('can be filled in with the keyboard', async () => {
    const user = userEvent.setup();
    render(<RequestForm sizes={EMPTY.sizes} />);
    await user.tab();
    const everyday = screen.getByRole('radio', { name: 'Everyday' });
    expect(everyday).toHaveFocus();
    await user.keyboard(' ');
    expect(everyday).toBeChecked();
  });
});

describe('profile summary on the request page', () => {
  it('says no department filter is applied when the profile has no department, with an edit link', () => {
    render(<ProfileSummary profile={EMPTY} />);
    expect(screen.getByRole('status')).toHaveTextContent('No department filter applied');
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile#style-profile');
  });

  it('shows the department, sizes, colours and coverage that will be applied', () => {
    render(
      <ProfileSummary
        profile={{
          ...EMPTY,
          department: 'women',
          sizes: { ...EMPTY.sizes, tops: { letter: 'M' }, shoes: { uk: 5 } },
          likedColors: ['ivory'],
          dislikedColors: ['beige'],
          coveragePreferences: { minSleeveLength: 'short', minNecklineCoverage: null, minGarmentLength: null },
        }}
      />,
    );
    expect(screen.queryByText(/No department filter applied/)).not.toBeInTheDocument();
    expect(screen.getByText('Women')).toBeInTheDocument();
    expect(screen.getByText('Tops M · Shoes UK 5')).toBeInTheDocument();
    expect(screen.getByText('Ivory')).toBeInTheDocument();
    expect(screen.getByText('Beige')).toBeInTheDocument();
    expect(screen.getByText('Sleeves at least short sleeve')).toBeInTheDocument();
  });
});
