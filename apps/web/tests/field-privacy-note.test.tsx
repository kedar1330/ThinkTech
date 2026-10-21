// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldPrivacyNote } from '../components/profile/FieldPrivacyNote';

describe('FieldPrivacyNote component', () => {
  it('renders the provisional badge and data use breakdown', () => {
    render(
      <FieldPrivacyNote
        usedFor="Style suggestions"
        whoSees="Only you"
        howToDelete="Delete anytime"
      />,
    );

    expect(screen.getByText('Provisional — pending legal review')).toBeInTheDocument();
    expect(screen.getByText('Privacy & data use')).toBeInTheDocument();
    expect(screen.getByText('Used for:')).toBeInTheDocument();
    expect(screen.getByText('Style suggestions')).toBeInTheDocument();
    expect(screen.getByText('Who sees it:')).toBeInTheDocument();
    expect(screen.getByText('Only you')).toBeInTheDocument();
    expect(screen.getByText('How to delete:')).toBeInTheDocument();
    expect(screen.getByText('Delete anytime')).toBeInTheDocument();
  });

  it('uses secure defaults for whoSees and howToDelete when omitted', () => {
    render(<FieldPrivacyNote usedFor="Palette suggestions" />);

    expect(screen.getByText(/Private to you\. Never shared with other users/)).toBeInTheDocument();
    expect(screen.getByText(/permanently deleted if you delete your account/)).toBeInTheDocument();
  });

  it('has accessible role and label', () => {
    render(<FieldPrivacyNote usedFor="Testing" />);
    expect(screen.getByRole('complementary', { name: 'Privacy and data use' })).toBeInTheDocument();
  });
});
