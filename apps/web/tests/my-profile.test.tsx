// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AppearanceResponse, MeasurementsResponse } from '@styleme/contracts';

// My Profile sections (D-129): photo or manual entry, results with review, and the measurement stepper.

const actions = vi.hoisted(() => ({
  saveSkinTone: vi.fn(async () => ({ success: 'Saved.' })),
  saveBodyType: vi.fn(async () => ({ success: 'Saved.' })),
  confirm: vi.fn(async () => ({ success: 'Thanks — confirmed.' })),
  saveMeasurements: vi.fn(async () => ({ measurements: {} })),
}));
vi.mock('@/app/actions/appearance', () => ({
  saveSkinToneAction: actions.saveSkinTone,
  saveBodyTypeAction: actions.saveBodyType,
  confirmAppearanceAction: actions.confirm,
  setUseInRecommendationsAction: vi.fn(),
  clearAppearanceAction: vi.fn(),
}));
vi.mock('@/app/actions/measurements', () => ({ saveMeasurementsAction: actions.saveMeasurements }));
vi.mock('@/app/actions/photos', () => ({ uploadPhotoAction: vi.fn(), deletePhotoAction: vi.fn() }));
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { BodyTypeSection } from '@/components/profile/BodyTypeSection';
import { SkinToneSection } from '@/components/profile/SkinToneSection';

const EMPTY: AppearanceResponse = {
  skinTone: null,
  undertone: null,
  bodyProportions: null,
  bodyType: null,
  useInRecommendations: true,
};
const NO_MEASUREMENTS: MeasurementsResponse = {
  displayUnit: 'in',
  valuesCm: {},
  updatedAt: null,
  bodyTypeFromMeasurements: null,
};
const estimate = <T,>(value: T) => ({
  value,
  source: 'photo_estimate' as const,
  userConfirmed: false,
  confirmedAt: null,
  estimate: { analysisId: 'a'.repeat(24), confidence: 'high' as const },
});

describe('Skin tone & undertone', () => {
  it('offers photo or manual; choosing one hides the other', async () => {
    const user = userEvent.setup();
    render(<SkinToneSection appearance={EMPTY} analysisAvailable />);
    expect(screen.queryByText('Manual skin tone selection')).toBeNull();
    expect(screen.queryByText('Upload your face photo')).toBeNull();

    await user.click(screen.getByRole('radio', { name: /Upload my face photo/ }));
    expect(screen.getByText('Upload your face photo')).toBeInTheDocument();
    expect(screen.queryByText('Manual skin tone selection')).toBeNull();

    await user.click(screen.getByRole('radio', { name: /Choose manually/ }));
    expect(screen.getByText('Manual skin tone selection')).toBeInTheDocument();
    expect(screen.queryByText('Upload your face photo')).toBeNull();
  });

  it('manual: select a Monk tone and one of four undertones, then save', async () => {
    const user = userEvent.setup();
    render(<SkinToneSection appearance={EMPTY} analysisAvailable={false} />);
    expect(screen.getByRole('radio', { name: /Upload my face photo/ })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /Choose manually/ }));
    const undertones = within(screen.getByRole('radiogroup', { name: 'Undertone' })).getAllByRole('radio');
    expect(undertones.map((u) => u.textContent)).toEqual([
      'Cool(pinkish)',
      'Neutral(balanced)',
      'Warm(golden)',
      'Olive(greenish)',
    ]);
    await user.click(screen.getByRole('radio', { name: 'Skin tone 7' }));
    await user.click(screen.getByRole('radio', { name: /Olive/ }));
    await user.click(screen.getByRole('button', { name: 'Save skin tone and undertone' }));
    expect(actions.saveSkinTone).toHaveBeenCalledWith({ monkTone: 7, undertone: 'olive' });
  });

  it('shows a photo result at once and lets the user confirm or correct it', async () => {
    const user = userEvent.setup();
    const appearance = { ...EMPTY, skinTone: estimate({ monkRange: '6-6' }), undertone: estimate('warm' as const) };
    render(<SkinToneSection appearance={appearance} analysisAvailable />);
    expect(screen.getByText('Skin tone 6')).toBeInTheDocument();
    expect(screen.getByText('Warm undertone')).toBeInTheDocument();
    expect(screen.getByText(/From your photo · high confidence · waiting for your review/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, that’s right' }));
    expect(actions.confirm).toHaveBeenCalledWith(['skinTone', 'undertone']);
    await user.click(screen.getByRole('button', { name: 'Correct it' }));
    expect(screen.getByRole('radio', { name: 'Skin tone 6' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Body type', () => {
  it('asks for the Clothing Preference first', () => {
    render(<BodyTypeSection department={null} appearance={EMPTY} measurements={NO_MEASUREMENTS} analysisAvailable />);
    expect(screen.getByText(/Choose your clothing preference above first/)).toBeInTheDocument();
  });

  it('women: steps through the five body-type measurements, each with its illustration', async () => {
    const user = userEvent.setup();
    render(<BodyTypeSection department="women" appearance={EMPTY} measurements={NO_MEASUREMENTS} analysisAvailable />);
    await user.click(screen.getByRole('radio', { name: /Enter my measurements/ }));
    const stepper = screen.getByRole('region', { name: 'Required measurements — Women' });
    expect(within(stepper).getByText('Step 1 of 5: Shoulder circumference')).toBeInTheDocument();
    expect(within(stepper).getByAltText('How to measure your shoulder circumference')).toHaveAttribute(
      'src',
      '/illustrations/profile/measure-women-shoulder.svg',
    );
    // A value is needed before moving on.
    await user.click(within(stepper).getByRole('button', { name: 'Next' }));
    expect(within(stepper).getByRole('alert')).toHaveTextContent('Add your shoulder circumference to continue.');

    for (const value of ['39', '36', '28', '38']) {
      await user.type(within(stepper).getByRole('spinbutton'), value);
      await user.click(within(stepper).getByRole('button', { name: 'Next' }));
    }
    expect(within(stepper).getByText('Step 5 of 5: High hip')).toBeInTheDocument();
    await user.type(within(stepper).getByRole('spinbutton'), '33');
    await user.click(within(stepper).getByRole('button', { name: 'Save & see my body type' }));
    expect(actions.saveMeasurements).toHaveBeenCalledWith({
      displayUnit: 'in',
      valuesCm: { shoulder: 99.1, bust: 91.4, waist: 71.1, hip: 96.5, highHip: 83.8 },
    });
  });

  it('men: asks shoulder, chest, waist and hip, and offers only men’s body types', async () => {
    const user = userEvent.setup();
    render(<BodyTypeSection department="men" appearance={EMPTY} measurements={NO_MEASUREMENTS} analysisAvailable />);
    await user.click(screen.getByRole('radio', { name: /Enter my measurements/ }));
    const stepper = screen.getByRole('region', { name: 'Required measurements — Men' });
    expect(within(stepper).getByText('Step 1 of 4: Shoulder circumference')).toBeInTheDocument();
    await user.click(screen.getByText('I know my body type — choose it instead'));
    const types = within(screen.getByRole('radiogroup', { name: 'Body type' })).getAllByRole('radio');
    expect(types.map((t) => t.querySelector('span')?.textContent)).toEqual([
      'Rectangle',
      'Triangle',
      'Inverted triangle',
      'Trapezoid',
      'Oval',
    ]);
  });

  it('shows the result with its source and lets the user correct it', async () => {
    const user = userEvent.setup();
    const appearance = { ...EMPTY, bodyType: { ...estimate('pear' as const), source: 'measurements' as const } };
    render(
      <BodyTypeSection department="women" appearance={appearance} measurements={NO_MEASUREMENTS} analysisAvailable />,
    );
    expect(screen.getByText('Pear (triangle)')).toBeInTheDocument();
    expect(screen.getByText(/From your measurements · waiting for your review/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Correct it' }));
    await user.click(screen.getByRole('radio', { name: /Spoon/ }));
    await user.click(screen.getByRole('button', { name: 'Save body type' }));
    expect(actions.saveBodyType).toHaveBeenCalledWith('spoon');
  });

  it('keeps fit measurements in a separate, optional section', () => {
    render(<BodyTypeSection department="women" appearance={EMPTY} measurements={NO_MEASUREMENTS} analysisAvailable />);
    expect(screen.getByText(/Add fit measurements \(optional\)/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Fit measurements — Women' })).toHaveTextContent(
      'Step 1 of 17: Underbust',
    );
  });
});
