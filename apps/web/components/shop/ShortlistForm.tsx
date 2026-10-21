'use client';

import { useActionState, useState } from 'react';
import { SHORTLIST_LIMITS, USER_ENTERED_LABELS } from '@styleme/contracts';
import { addShortlistItemAction } from '@/app/actions/shortlist';
import type { FormState } from '@/lib/actions';
import { FormMessage, SubmitButton } from '@/components/auth/shared';
import { Field } from '@/components/ui/field';
import { Input, inputClass } from '@/components/ui/input';
import { FieldPrivacyNote } from '@/components/profile/FieldPrivacyNote';
import { cn } from '@/lib/utils';

// "Add an item you found" (FR-LIST-01). Inputs are controlled, so a failed submit keeps every entry;
// they are cleared only once the item is added. Nothing typed here is checked against any shop.

type Values = { name: string; priceEntered: string; url: string; note: string };
const EMPTY: Values = { name: '', priceEntered: '', url: '', note: '' };

/** Wires a control to its hint or error text (the IDs `Field` renders). */
function describedBy(id: string, error?: string, hint?: boolean): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

export function ShortlistForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addShortlistItemAction(prev, formData);
    if (result?.success) setValues(EMPTY);
    return result;
  }, undefined);
  const errors = state?.fieldErrors ?? {};
  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <form action={action} className="space-y-4" noValidate>
      <Field id="name" label="Item name" error={errors.name}>
        <Input
          id="name"
          name="name"
          required
          maxLength={SHORTLIST_LIMITS.nameMax}
          value={values.name}
          onChange={set('name')}
          aria-invalid={Boolean(errors.name) || undefined}
          aria-describedby={describedBy('name', errors.name)}
        />
      </Field>
      <Field id="priceEntered" label="Price you saw (₹)" hint={USER_ENTERED_LABELS.price} error={errors.priceEntered}>
        <Input
          id="priceEntered"
          name="priceEntered"
          required
          inputMode="decimal"
          autoComplete="off"
          placeholder="1299"
          value={values.priceEntered}
          onChange={set('priceEntered')}
          aria-invalid={Boolean(errors.priceEntered) || undefined}
          aria-describedby={describedBy('priceEntered', errors.priceEntered, true)}
        />
      </Field>
      <Field id="url" label="Link" optional hint="Starts with https://. We never open or change it." error={errors.url}>
        <Input
          id="url"
          name="url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          maxLength={SHORTLIST_LIMITS.urlMax}
          value={values.url}
          onChange={set('url')}
          aria-invalid={Boolean(errors.url) || undefined}
          aria-describedby={describedBy('url', errors.url, true)}
        />
      </Field>
      <Field id="note" label="Note" optional hint={`Up to ${SHORTLIST_LIMITS.noteMax} characters.`} error={errors.note}>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={SHORTLIST_LIMITS.noteMax}
          value={values.note}
          onChange={set('note')}
          className={cn(inputClass, 'h-auto py-2.5')}
          aria-invalid={Boolean(errors.note) || undefined}
          aria-describedby={describedBy('note', errors.note, true)}
        />
      </Field>
      <FieldPrivacyNote
        usedFor="Keeping items you found in other shops and their prices to compare against your budget. StyleMe never opens, previews, or checks your links."
        whoSees="Private to you. Never used for other people’s suggestions and never sent to any external AI service."
        howToDelete="You can delete any item at any time, and your entire shortlist is permanently removed if you delete your account."
      />
      <FormMessage state={state} />
      <div className="max-w-xs">
        <SubmitButton pending={pending} pendingLabel="Adding…">
          Add to shortlist
        </SubmitButton>
      </div>
    </form>
  );
}
