// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileResponse, UserPhoto } from '@styleme/contracts';

const mockProfileActions = vi.hoisted(() => ({
  saveTryOnModelAction: vi.fn(),
}));

const mockPhotoActions = vi.hoisted(() => ({
  uploadTryOnPhotoAction: vi.fn(),
  deletePhotoAction: vi.fn(),
}));

vi.mock('@/app/actions/profile', () => mockProfileActions);
vi.mock('@/app/actions/photos', () => mockPhotoActions);

import { VirtualTryOnSection } from '@/components/profile/VirtualTryOnSection';

const BASE_PROFILE: ProfileResponse = {
  department: 'women',
  ageGroup: '25_34',
  heightCm: 165,
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
  tryOnModel: 'dummy_model',
  updatedAt: null,
};

describe('VirtualTryOnSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both options: Upload your photo and Try on dummy model', () => {
    render(<VirtualTryOnSection profile={BASE_PROFILE} photos={[]} />);

    expect(screen.getByRole('radio', { name: /upload your photo/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /try on dummy model/i })).toBeInTheDocument();
    expect(screen.getByText(/standard 3d dummy model active/i)).toBeInTheDocument();
  });

  it('switches to dummy model and invokes saveTryOnModelAction', async () => {
    mockProfileActions.saveTryOnModelAction.mockResolvedValueOnce({ success: 'Saved.' });
    const user = userEvent.setup();

    render(<VirtualTryOnSection profile={{ ...BASE_PROFILE, tryOnModel: 'custom_photo' }} photos={[]} />);

    const dummyButton = screen.getByRole('radio', { name: /try on dummy model/i });
    await user.click(dummyButton);

    expect(mockProfileActions.saveTryOnModelAction).toHaveBeenCalledWith('dummy_model');
  });

  it('shows upload panel when upload photo is selected', async () => {
    const user = userEvent.setup();
    render(<VirtualTryOnSection profile={BASE_PROFILE} photos={[]} />);

    const photoOption = screen.getByRole('radio', { name: /upload your photo/i });
    await user.click(photoOption);

    expect(screen.getByText(/personalized 3d model setup/i)).toBeInTheDocument();
    expect(screen.getByText(/upload photo for your 3d model/i)).toBeInTheDocument();
  });

  it('displays existing body photo when present', () => {
    const existingPhoto: UserPhoto = {
      id: 'photo123',
      kind: 'body',
      angle: 'front',
      contentType: 'image/jpeg',
      bytes: 50000,
      retention: 'keep',
      uploadedAt: '2026-10-23T00:00:00.000Z',
      analyzedAt: null,
    };

    render(<VirtualTryOnSection profile={{ ...BASE_PROFILE, tryOnModel: 'custom_photo' }} photos={[existingPhoto]} />);

    expect(screen.getByText(/current 3d model reference photo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change photo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });
});
