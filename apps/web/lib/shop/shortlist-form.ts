import {
  SHORTLIST_LIMITS,
  createShortlistItemRequestSchema,
  type CreateShortlistItemRequest,
} from '@styleme/contracts';
import { formatInr } from './format';

// Turns the "add an item you found" form into a POST /v1/shortlist body (FR-LIST-01, -07). The contract
// does the validation; this only converts form strings: the price to a number of rupees, and empty
// optional fields are left out. Attaching to a look is not offered here (#43).

export interface ShortlistFormFields {
  name?: string;
  priceEntered?: string;
  url?: string;
  note?: string;
}

export type ShortlistFormResult =
  { ok: true; body: CreateShortlistItemRequest } | { ok: false; fieldErrors: Record<string, string> };

const PRICE_FORMAT = 'Enter the price in rupees, for example 1299 or 1299.50.';

/** "₹1,299.50", "1,299" and "1299.5" all mean 1299.5 rupees; anything else stays a string and fails. */
function toRupees(raw: string): number | string | undefined {
  const cleaned = raw.replace(/[₹,\s]/g, '');
  if (!cleaned) return undefined;
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : raw;
}

function message(field: string, code: string, fields: ShortlistFormFields): string {
  switch (field) {
    case 'name':
      return code === 'too_big'
        ? `Use ${SHORTLIST_LIMITS.nameMax} characters or fewer.`
        : 'Enter the name of the item.';
    case 'priceEntered':
      if (!fields.priceEntered?.trim()) return 'Enter the price you saw.';
      if (code === 'too_big') return `Enter a price up to ${formatInr(SHORTLIST_LIMITS.priceMax)}.`;
      if (code === 'too_small') return 'Enter a price above ₹0.';
      return PRICE_FORMAT;
    case 'url':
      return code === 'too_big'
        ? `Use a link of ${SHORTLIST_LIMITS.urlMax.toLocaleString('en-IN')} characters or fewer.`
        : 'Enter a link that starts with https://';
    case 'note':
      return `Use ${SHORTLIST_LIMITS.noteMax} characters or fewer.`;
    default:
      return 'Please check this field.';
  }
}

export function shortlistFormToRequest(fields: ShortlistFormFields): ShortlistFormResult {
  const parsed = createShortlistItemRequestSchema.safeParse({
    name: fields.name ?? '',
    priceEntered: toRupees(fields.priceEntered ?? ''),
    url: fields.url?.trim() || undefined,
    note: fields.note?.trim() || undefined,
  });
  if (parsed.success) return { ok: true, body: parsed.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    fieldErrors[key] ??= message(key, issue.code, fields);
  }
  return { ok: false, fieldErrors };
}
