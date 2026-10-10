// Transactional email (FR-AUTH-13). No provider is chosen until HC-2 (D-84), so the API has no real
// sender yet. Tests inject a recording sender. Reset emails must be sent with the provider's link and
// open tracking turned off (SECURITY.md §1.1).

export interface EmailSender {
  sendPasswordReset(to: string, resetLink: string): Promise<void>;
}

export const noEmailProvider: EmailSender = {
  async sendPasswordReset() {
    throw new Error('No email provider is configured (decided at HC-2, D-84)');
  },
};
