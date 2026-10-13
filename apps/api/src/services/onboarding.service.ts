import type { OnboardingStep } from '@styleme/contracts';
import type { Models } from '../models/index';
import { AppError } from '../utils/errors';
import { onboardingStep, type UserWithId } from './auth.service';

// Onboarding progress (FR-ONB-01 … 04). The server decides the next step; the web app only follows it.
// Order: [set password — Google sign-ups] → style profile → appearance → complete.

export class OnboardingService {
  constructor(private readonly models: Models) {}

  status(user: UserWithId): { step: OnboardingStep } {
    return { step: onboardingStep(user) };
  }

  /** Style Profile is complete once the profile (department) is saved and the city is known. */
  async completeStyleProfile(user: UserWithId): Promise<{ step: OnboardingStep }> {
    if (!user.passwordHash) throw new AppError('PASSWORD_SETUP_REQUIRED');
    const profile = await this.models.Profile.exists({ userId: user._id });
    if (!profile) throw new AppError('INVALID_REQUEST', 'Save your style profile first — the department is required.');
    if (!user.city) throw new AppError('INVALID_REQUEST', 'Add your city to continue.');
    const updated = await this.models.User.findOneAndUpdate(
      { _id: user._id },
      { $set: { 'onboarding.styleProfileCompletedAt': user.onboarding?.styleProfileCompletedAt ?? new Date() } },
      { returnDocument: 'after' },
    ).lean();
    return { step: onboardingStep(updated!) };
  }

  /** Appearance signals are optional: saving or skipping both complete this step. */
  async completeAppearance(user: UserWithId): Promise<{ step: OnboardingStep }> {
    if (!user.onboarding?.styleProfileCompletedAt) {
      throw new AppError('INVALID_REQUEST', 'Complete your style profile first.');
    }
    const updated = await this.models.User.findOneAndUpdate(
      { _id: user._id },
      { $set: { 'onboarding.appearanceCompletedAt': user.onboarding?.appearanceCompletedAt ?? new Date() } },
      { returnDocument: 'after' },
    ).lean();
    return { step: onboardingStep(updated!) };
  }
}
