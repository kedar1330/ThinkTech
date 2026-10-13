import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Logger } from 'pino';
import type { Config } from '../config/env';

// Outbound email and SMS (D-84, D-92). Providers are reached only through these interfaces
// (NFR-MNT-03). Messages contain one-time codes and links, so their content is never logged.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface SmsMessage {
  to: string;
  text: string;
}

export interface EmailSender {
  readonly kind: 'smtp' | 'dev-outbox' | 'test';
  send(message: EmailMessage): Promise<void>;
}

export interface SmsSender {
  readonly kind: 'dev-outbox' | 'test';
  send(message: SmsMessage): Promise<void>;
}

/** Any SMTP provider (D-84). Link and open tracking must be off for these messages (SECURITY.md §1.1). */
export function smtpEmailSender(smtpUrl: string, from: string): EmailSender {
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    kind: 'smtp',
    async send(message) {
      await transport.sendMail({ from, to: message.to, subject: message.subject, text: message.text });
    },
  };
}

/**
 * Local development only: writes each message to a JSON file in DEV_OUTBOX_DIR (git-ignored) instead
 * of sending it, so codes and links can be tested without a provider. Refused outside APP_ENV=local.
 */
function devOutbox(dir: string, logger: Logger, kind: 'email' | 'sms') {
  return async (message: EmailMessage | SmsMessage) => {
    await mkdir(dir, { recursive: true });
    const file = join(
      dir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${kind}-${randomUUID().slice(0, 8)}.json`,
    );
    await writeFile(file, JSON.stringify({ kind, ...message }, null, 2), 'utf8');
    logger.info({ event: 'dev_outbox_message_written', kind });
  };
}

/** Whether messages are echoed to the terminal: local development only, never staging or production. */
export function terminalEchoEnabled(config: Pick<Config, 'APP_ENV' | 'DEV_ECHO_MESSAGES'>): boolean {
  return config.APP_ENV === 'local' && config.DEV_ECHO_MESSAGES;
}

/** A readable terminal block for one message, with the one-time code and link pulled out. */
export function formatTerminalEcho(kind: 'email' | 'sms', message: EmailMessage | SmsMessage): string {
  const code = /\b(\d{6})\b/.exec(message.text)?.[1];
  const url = /https?:\/\/\S+/.exec(message.text)?.[0];
  const rule = '─'.repeat(64);
  const lines = [
    '',
    `┌${rule}`,
    `│ DEV ${kind.toUpperCase()} (local only, not sent to production logs)`,
    `│ To:      ${message.to}`,
    ...('subject' in message ? [`│ Subject: ${message.subject}`] : []),
    ...(code ? [`│ Code:    ${code}`] : []),
    ...(url ? [`│ Link:    ${url}`] : []),
    `└${rule}`,
    '',
  ];
  return lines.join('\n');
}

/**
 * Local development only: prints the message to the terminal before handing it to the real sender, so
 * codes are visible even if delivery fails. Written straight to the terminal rather than the logger, so
 * codes never enter structured logs. Only ever applied when terminalEchoEnabled(config) is true.
 */
function withTerminalEcho<T extends EmailSender | SmsSender>(
  sender: T,
  kind: 'email' | 'sms',
  write: (text: string) => void,
): T {
  return {
    ...sender,
    async send(message: EmailMessage & SmsMessage) {
      write(formatTerminalEcho(kind, message));
      await sender.send(message);
    },
  };
}

const stdoutWrite = (text: string) => void process.stdout.write(text);

export function createEmailSender(
  config: Config,
  logger: Logger,
  write: (text: string) => void = stdoutWrite,
): EmailSender {
  let sender: EmailSender;
  if (config.SMTP_URL) {
    if (!config.EMAIL_FROM) throw new Error('EMAIL_FROM is required when SMTP_URL is set');
    sender = smtpEmailSender(config.SMTP_URL, config.EMAIL_FROM);
  } else if (config.APP_ENV !== 'local') {
    throw new Error('SMTP_URL and EMAIL_FROM must be set outside local development (D-84)');
  } else {
    sender = { kind: 'dev-outbox', send: devOutbox(config.DEV_OUTBOX_DIR, logger, 'email') };
  }
  return terminalEchoEnabled(config) ? withTerminalEcho(sender, 'email', write) : sender;
}

/** Null when no SMS provider is available: phone verification then reports PROVIDER_NOT_CONFIGURED. */
export function createSmsSender(
  config: Config,
  logger: Logger,
  write: (text: string) => void = stdoutWrite,
): SmsSender | null {
  if (config.APP_ENV !== 'local') return null;
  const sender: SmsSender = { kind: 'dev-outbox', send: devOutbox(config.DEV_OUTBOX_DIR, logger, 'sms') };
  return terminalEchoEnabled(config) ? withTerminalEcho(sender, 'sms', write) : sender;
}
