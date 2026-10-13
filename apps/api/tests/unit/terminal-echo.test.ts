import { rm } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';
import { createLogger } from '../../src/logger';
import { createEmailSender, createSmsSender, terminalEchoEnabled } from '../../src/services/messaging';
import { templates } from '../../src/services/templates';
import { BASE_CONFIG } from '../helpers';

const OUTBOX = '.dev-outbox-echo-test';
const LOCAL = { ...BASE_CONFIG, DEV_OUTBOX_DIR: OUTBOX, DEV_ECHO_MESSAGES: true };
const logLines: string[] = [];
const logger = createLogger({ write: (line: string) => void logLines.push(line) });

afterAll(async () => {
  await rm(OUTBOX, { recursive: true, force: true });
});

describe('terminal echo of dev messages', () => {
  it('prints the verification code and link to the terminal in local development, not to the logs', async () => {
    const printed: string[] = [];
    const sender = createEmailSender(LOCAL, logger, (t) => printed.push(t));
    await sender.send(
      templates.verifyEmail(
        'vishal@gmail.com',
        'Vishal',
        '482913',
        'http://localhost:3000/verify-email/link#token=abc',
      ),
    );
    const out = printed.join('');
    expect(out).toContain('To:      vishal@gmail.com');
    expect(out).toContain('Code:    482913');
    expect(out).toContain('Link:    http://localhost:3000/verify-email/link#token=abc');
    expect(logLines.join('')).not.toContain('482913');
  });

  it('prints SMS codes locally', async () => {
    const printed: string[] = [];
    const sms = createSmsSender(LOCAL, logger, (t) => printed.push(t));
    await sms!.send({ to: '+919876543210', text: 'Your StyleMe code is 135790' });
    expect(printed.join('')).toContain('Code:    135790');
  });

  it('can be switched off locally', async () => {
    const printed: string[] = [];
    const sender = createEmailSender({ ...LOCAL, DEV_ECHO_MESSAGES: false }, logger, (t) => printed.push(t));
    await sender.send(templates.resetPasswordOtp('a@example.com', '111222'));
    expect(printed).toHaveLength(0);
  });

  it('never prints outside local development, even if the flag is set', async () => {
    expect(terminalEchoEnabled({ APP_ENV: 'production', DEV_ECHO_MESSAGES: true })).toBe(false);
    expect(terminalEchoEnabled({ APP_ENV: 'staging', DEV_ECHO_MESSAGES: true })).toBe(false);
    const printed: string[] = [];
    const sender = createEmailSender(
      { ...LOCAL, APP_ENV: 'production', SMTP_URL: 'smtp://127.0.0.1:1', EMAIL_FROM: 'no-reply@example.com' },
      logger,
      (t) => printed.push(t),
    );
    expect(sender.kind).toBe('smtp');
    expect(createSmsSender({ ...LOCAL, APP_ENV: 'production' }, logger, (t) => printed.push(t))).toBeNull();
    expect(printed).toHaveLength(0);
  });
});
