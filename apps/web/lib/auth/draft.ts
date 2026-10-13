// Registration draft (spec: 24-hour local draft). Only non-sensitive fields are kept: never the
// password, its confirmation, or the Terms/Privacy consent, which must be given fresh each time.
// Browser storage can be unavailable (private mode, blocked site data), so every access is guarded.

export const DRAFT_KEY = 'styleme.registration-draft';
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface RegistrationDraft {
  fullName: string;
  email: string;
  city: string;
  phone: string;
  marketingOptIn: boolean;
  rememberMe: boolean;
}

const FIELDS: (keyof RegistrationDraft)[] = ['fullName', 'email', 'city', 'phone', 'marketingOptIn', 'rememberMe'];

/** Keeps only the allowed fields, with the right types. */
export function sanitizeDraft(input: unknown): RegistrationDraft | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 254) : '');
  return {
    fullName: text(o.fullName),
    email: text(o.email),
    city: text(o.city),
    phone: text(o.phone),
    marketingOptIn: o.marketingOptIn === true,
    rememberMe: o.rememberMe === true,
  };
}

export function serializeDraft(draft: RegistrationDraft, now = Date.now()): string {
  const clean = sanitizeDraft(draft)!;
  return JSON.stringify({ savedAt: now, draft: Object.fromEntries(FIELDS.map((f) => [f, clean[f]])) });
}

export function parseDraft(raw: string | null, now = Date.now()): RegistrationDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: unknown; draft?: unknown };
    if (typeof parsed.savedAt !== 'number' || now - parsed.savedAt > DRAFT_TTL_MS || now < parsed.savedAt) return null;
    return sanitizeDraft(parsed.draft);
  } catch {
    return null;
  }
}

function isEmpty(d: RegistrationDraft): boolean {
  return !d.fullName && !d.email && !d.city && !d.phone && !d.marketingOptIn && !d.rememberMe;
}

export const EMPTY_DRAFT: RegistrationDraft = {
  fullName: '',
  email: '',
  city: '',
  phone: '',
  marketingOptIn: false,
  rememberMe: false,
};

let cachedRaw: string | null | undefined;
let cachedDraft: RegistrationDraft | null = null;

/**
 * The stored draft, or null. Returns the same object while the stored text is unchanged, as
 * `useSyncExternalStore` requires. Expired or invalid drafts are removed.
 */
export function readStoredDraft(): RegistrationDraft | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDraft = parseDraft(raw);
    if (raw && !cachedDraft) {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
    }
  }
  return cachedDraft;
}

export function saveRegistrationDraft(draft: RegistrationDraft): void {
  try {
    if (isEmpty(draft)) window.localStorage.removeItem(DRAFT_KEY);
    else window.localStorage.setItem(DRAFT_KEY, serializeDraft(draft));
  } catch {
    // Storage unavailable: the form still works, it just isn't remembered.
  }
}

export function clearRegistrationDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
