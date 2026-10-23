// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDesignAction: vi.fn(
    async (_form: FormData) => ({ designId: '64b7f0c2a1b2c3d4e5f60718' }) as { designId?: string; error?: string },
  ),
  push: vi.fn(),
}));
vi.mock('@/app/actions/design-studio', () => ({ createDesignAction: mocks.createDesignAction }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

import { DesignStudioForm, type LookToChange } from '@/components/design-studio/DesignStudioForm';

// Design Studio input (D-134): draw / upload / describe, or change a look from Discover My Style.

const LOOK: LookToChange = {
  id: '64b7f0c2a1b2c3d4e5f60719',
  pieces: [
    { slotId: 'top', label: 'Kurta', details: 'Cotton · Straight', swatches: [{ name: 'Teal', hex: '#2F6F6A' }] },
    { slotId: 'bottom', label: 'Palazzo', details: '', swatches: [{ name: 'Ivory', hex: '#F5F0E6' }] },
  ],
};

beforeEach(() => {
  mocks.createDesignAction.mockClear();
  mocks.push.mockClear();
});

describe('DesignStudioForm', () => {
  it('offers Draw, Upload and Describe; Describe needs words and the notice before it sends', async () => {
    const user = userEvent.setup();
    render(<DesignStudioForm />);
    for (const tab of ['Draw', 'Upload', 'Describe'])
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Drawing area/ })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Describe' }));
    const generate = screen.getByRole('button', { name: 'Generate my design' });
    await user.type(screen.getByLabelText('Describe your idea'), 'A green georgette anarkali with bell sleeves');
    expect(generate).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(generate).toBeEnabled();
    await user.click(generate);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/design-studio/64b7f0c2a1b2c3d4e5f60718'));
    const form = mocks.createDesignAction.mock.calls[0]![0];
    expect(form.get('source')).toBe('description');
    expect(form.get('description')).toBe('A green georgette anarkali with bell sleeves');
    expect(form.get('notice')).toBe('on');
    expect(form.get('image')).toBeNull();
  });

  it('a look: shows its pieces, adds quick changes, and sends the look and the chosen piece', async () => {
    const user = userEvent.setup();
    render(<DesignStudioForm look={LOOK} />);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText('Kurta')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('What should change?'), 'top');
    await user.click(screen.getByRole('button', { name: '+ Puff sleeves' }));
    expect(screen.getByLabelText('Your changes')).toHaveValue('Puff sleeves.');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Design my changes' }));

    await waitFor(() => expect(mocks.createDesignAction).toHaveBeenCalled());
    const form = mocks.createDesignAction.mock.calls[0]![0];
    expect(form.get('source')).toBe('look');
    expect(form.get('lookId')).toBe(LOOK.id);
    expect(form.get('slotId')).toBe('top');
    expect(form.get('description')).toBe('Puff sleeves.');
  });

  it('shows the API’s message when the design can’t be made, and stays on the page', async () => {
    mocks.createDesignAction.mockResolvedValueOnce({ error: 'Please don’t upload photos of people.' });
    const user = userEvent.setup();
    render(<DesignStudioForm look={LOOK} />);
    await user.type(screen.getByLabelText('Your changes'), 'Shorter');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Design my changes' }));
    expect(await screen.findByText('Please don’t upload photos of people.')).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
