import type { EmailMessage, SmsMessage } from './messaging';

// Message texts. Links carry the token in the URL fragment (#token=…), which browsers never send to
// servers or in Referer headers (SECURITY.md §1.1).

const SIGN_OFF = '\n\n— The StyleMe team\nIf you did not request this, you can ignore this email.';

export function link(webOrigin: string, path: string, token: string): string {
  return `${webOrigin}${path}#token=${token}`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export const templates = {
  /** Sign-up code (code only, no link: a pending registration is verified in the browser that registered). */
  registrationOtp(to: string, name: string, otp: string): EmailMessage {
    const text =
      `Hello ${name},\n\nWelcome to StyleMe!\n\n` +
      'Use the following verification code to verify your email address and complete your registration:\n\n' +
      `    ${otp}\n\n` +
      'This code expires in 5 minutes. Do not share this code with anyone.\n\n' +
      'If you did not request this registration, you can safely ignore this email.\n\n' +
      'Regards,\nStyleMe Team';
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verify your StyleMe email address</title></head>
<body style="margin:0;padding:0;background:#f7f3ee;font-family:Arial,Helvetica,sans-serif;color:#2b1d2a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ee;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#4a1d3f;padding:20px 28px;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#ffffff;">Style<span style="font-style:italic;color:#e3c58b;">Me</span></td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.6;">
          <p style="margin:0 0 12px;">Hello ${escapeHtml(name)},</p>
          <p style="margin:0 0 12px;">Welcome to StyleMe!</p>
          <p style="margin:0 0 20px;">Use the following verification code to verify your email address and complete your registration:</p>
          <p style="margin:0 0 20px;text-align:center;">
            <span style="display:inline-block;padding:14px 24px;border:1px solid #e5d9e2;border-radius:10px;background:#faf6f9;font-family:'Courier New',monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:#4a1d3f;">${otp}</span>
          </p>
          <p style="margin:0 0 12px;">This code expires in <strong>5 minutes</strong>. Do not share this code with anyone.</p>
          <p style="margin:0 0 20px;color:#6b5a68;">If you did not request this registration, you can safely ignore this email.</p>
          <p style="margin:0;">Regards,<br>StyleMe Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    return { to, subject: 'Verify your StyleMe email address', text, html };
  },

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
