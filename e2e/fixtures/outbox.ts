import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { OUTBOX_DIR } from '../support/settings';

// Reads emails from the API's dev outbox (apps/api/src/services/messaging.ts): with APP_ENV=local and
// no SMTP provider, every message is written to DEV_OUTBOX_DIR as `<ISO time>-email-<id>.json`. The
// harness points that directory at OUTBOX_DIR, so no test-only API endpoint is needed.

export interface OutboxEmail {
  file: string;
  /** When the API wrote the message (ms since epoch, from the file name). */
  sentAt: number;
  to: string;
  subject: string;
  text: string;
}

export interface OutboxQuery {
  /** Only messages whose subject matches. */
  subject?: string | RegExp;
  /** Only messages written at or after this time (`Date.now()` taken before the triggering action). */
  since?: number;
  /** How long to wait for the message to arrive. */
  timeoutMs?: number;
}

const FILE = /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z-email-[\w-]+\.json$/;

async function emailsTo(email: string): Promise<OutboxEmail[]> {
  let files: string[];
  try {
    files = await readdir(OUTBOX_DIR);
  } catch {
    return [];
  }
  const out: OutboxEmail[] = [];
  for (const file of files.sort()) {
    const m = FILE.exec(file);
    if (!m) continue;
    let body: { to?: string; subject?: string; text?: string };
    try {
      body = JSON.parse(await readFile(join(OUTBOX_DIR, file), 'utf8'));
    } catch {
      continue; // still being written
    }
    if (body.to?.toLowerCase() !== email.toLowerCase()) continue;
    out.push({
      file,
      sentAt: Date.parse(`${m[1]}:${m[2]}:${m[3]}.${m[4]}Z`),
      to: body.to,
      subject: body.subject ?? '',
      text: body.text ?? '',
    });
  }
  return out;
}

function matches(message: OutboxEmail, { subject, since = 0 }: OutboxQuery): boolean {
  if (message.sentAt < since) return false;
  if (subject === undefined) return true;
  return typeof subject === 'string' ? message.subject === subject : subject.test(message.subject);
}

/** The newest email to `email` matching the query, waiting for it to arrive. */
export async function readEmail(email: string, query: OutboxQuery = {}): Promise<OutboxEmail> {
  const deadline = Date.now() + (query.timeoutMs ?? 15_000);
  for (;;) {
    const found = (await emailsTo(email)).filter((m) => matches(m, query)).at(-1);
    if (found) return found;
    if (Date.now() > deadline) {
      throw new Error(
        `No email to ${email} matching ${String(query.subject ?? 'any subject')} in the dev outbox (${OUTBOX_DIR}). ` +
          'Against BASE_URL, set E2E_OUTBOX_DIR to the outbox of the API serving that deployment.',
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** The 6-digit one-time code from the newest matching email. */
export async function readOtp(email: string, query: OutboxQuery = {}): Promise<string> {
  const message = await readEmail(email, query);
  const code = /\b(\d{6})\b/.exec(message.text)?.[1];
  if (!code) throw new Error(`The email "${message.subject}" to ${email} contains no 6-digit code.`);
  return code;
}

/** The emailed link (with its `#token=…` fragment) from the newest matching email. */
export async function readLink(email: string, query: OutboxQuery = {}): Promise<string> {
  const message = await readEmail(email, query);
  const link = /https?:\/\/\S+#token=[\w-]+/.exec(message.text)?.[0];
  if (!link) throw new Error(`The email "${message.subject}" to ${email} contains no link.`);
  return link;
}

/** Subjects of the emails the auth flows send (apps/api/src/services/templates.ts). */
export const SUBJECT = {
  verifyEmail: /^Verify your/,
  passwordChangeCode: 'Your StyleMe code to change your password',
  resetCode: 'Your StyleMe password reset code',
  resetLink: 'Reset your StyleMe password',
  deletionCode: 'Your StyleMe account deletion code',
} as const;
