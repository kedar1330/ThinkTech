import type { EmailMessage, SmsMessage } from './messaging';

// Message texts. Links carry the token in the URL fragment (#token=…), which browsers never send to
// servers or in Referer headers (SECURITY.md §1.1).

const SIGN_OFF = '\n\n— The StyleMe team\nIf you did not request this, you can ignore this email.';

export function link(webOrigin: string, path: string, token: string): string {
  return `${webOrigin}${path}#token=${token}`;
}

export const templates = {
  verifyEmail(to: string, name: string, otp: string, verifyLink: string): EmailMessage {
    return {
      to,
      subject: 'Verify your email for StyleMe',
      text:
        `Hi ${name},\n\nWelcome to StyleMe. Verify your email address with this code:\n\n    ${otp}\n\n` +
        `The code is valid for 5 minutes. Or open this link (valid for 30 minutes):\n${verifyLink}` +
        SIGN_OFF,
    };
  },

  resetPasswordOtp(to: string, otp: string): EmailMessage {
    return {
      to,
      subject: 'Your StyleMe password reset code',
      text: `Use this code to reset your StyleMe password:\n\n    ${otp}\n\nIt is valid for 5 minutes.` + SIGN_OFF,
    };
  },

  resetPasswordLink(to: string, resetLink: string): EmailMessage {
    return {
      to,
      subject: 'Reset your StyleMe password',
      text: `Open this link to choose a new StyleMe password (valid for 15 minutes):\n${resetLink}` + SIGN_OFF,
    };
  },

  passwordChangeOtp(to: string, otp: string): EmailMessage {
    return {
      to,
      subject: 'Your StyleMe code to change your password',
      text: `Use this code to change your StyleMe password:\n\n    ${otp}\n\nIt is valid for 5 minutes.` + SIGN_OFF,
    };
  },

  passwordChanged(to: string): EmailMessage {
    return {
      to,
      subject: 'Your StyleMe password was changed',
      text:
        'Your StyleMe password was just changed and your other sessions were signed out.\n\n' +
        'If this was not you, reset your password straight away from the StyleMe login page.\n\n— The StyleMe team',
    };
  },

  emailChangeVerify(to: string, otp: string, confirmLink: string): EmailMessage {
    return {
      to,
      subject: 'Confirm your new StyleMe email address',
      text:
        `Confirm this address for your StyleMe account with this code:\n\n    ${otp}\n\n` +
        `The code is valid for 5 minutes. Or open this link (valid for 30 minutes):\n${confirmLink}` +
        SIGN_OFF,
    };
  },

  emailChangedNotice(to: string, newEmail: string): EmailMessage {
    const masked = newEmail.replace(/^(.).*(@.*)$/, '$1•••$2');
    return {
      to,
      subject: 'Your StyleMe email address was changed',
      text:
        `The email address on your StyleMe account was changed to ${masked}. This address will no longer be used.\n\n` +
        'If this was not you, contact the StyleMe team straight away.\n\n— The StyleMe team',
    };
  },

  accountDeletionOtp(to: string, otp: string): EmailMessage {
    return {
      to,
      subject: 'Your StyleMe account deletion code',
      text:
        `Use this code to confirm that you want to permanently delete your StyleMe account:\n\n    ${otp}\n\n` +
        'It is valid for 5 minutes. Deletion cannot be undone.' +
        SIGN_OFF,
    };
  },

  phoneOtp(to: string, otp: string): SmsMessage {
    return { to, text: `StyleMe: your phone verification code is ${otp}. It is valid for 5 minutes.` };
  },
};

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}•••@${domain}`;
}

export function maskPhone(e164: string): string {
  return `+91 •••••• ${e164.slice(-4)}`;
}
