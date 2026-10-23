'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImageUp, Loader2, PenLine, Shirt, Type } from 'lucide-react';
import { DESIGN_DESCRIPTION_MAX, type DesignSource } from '@styleme/contracts';
import { createDesignAction } from '@/app/actions/design-studio';
import { Button } from '@/components/ui/button';
import { resizePhoto } from '@/lib/profile/photo-resize';
import { cn } from '@/lib/utils';
import { SketchPad, type SketchPadHandle } from './SketchPad';

// Design Studio input (D-134): draw, upload or describe an idea, or change a look from Discover My Style.
// Gemini reads it and writes the tailor spec; FLUX draws the design. Only the sketch and the words leave
// StyleMe, never the user's photos or profile.

export interface LookPiece {
  slotId: string;
  label: string;
  details: string;
  swatches: { name: string; hex: string }[];
}

export interface LookToChange {
  id: string;
  pieces: LookPiece[];
}

type Mode = Exclude<DesignSource, 'look'>;

const MODES: { id: Mode; label: string; icon: typeof PenLine }[] = [
  { id: 'sketch', label: 'Draw', icon: PenLine },
  { id: 'upload', label: 'Upload', icon: ImageUp },
  { id: 'description', label: 'Describe', icon: Type },
];

/** Quick changes for a look; each adds a sentence the user can edit. */
const CHANGES = [
  'Puff sleeves',
  'Bell sleeves',
  'Full sleeves',
  'Sleeveless',
  'V-neck',
  'Boat neck',
  'High neck',
  'Longer length',
  'Shorter length',
  'Add embroidery',
];

const PLACEHOLDER: Record<Mode | 'look', string> = {
  sketch: 'Optional: fabric, colours and details, e.g. “cotton silk, mustard, mirror work on the yoke”.',
  upload: 'Optional: what to keep or change from the picture, fabric and colours.',
  description:
    'Describe the outfit you imagine, e.g. “A floor-length anarkali in deep green georgette with elbow-length bell sleeves and gold zari on the neckline”.',
  look: 'What would you like to change? e.g. “Make the sleeves elbow-length puff sleeves and keep everything else”.',
};

export function DesignStudioForm({ look }: { look?: LookToChange }) {
  const router = useRouter();
  const ids = { description: useId(), piece: useId(), file: useId() };
  const pad = useRef<SketchPadHandle>(null);
  const [mode, setMode] = useState<Mode>('sketch');
  const [description, setDescription] = useState('');
  const [slotId, setSlotId] = useState('');
  const [hasDrawing, setHasDrawing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const source: DesignSource = look ? 'look' : mode;
  const ready =
    agreed &&
    !pending &&
    (source === 'sketch'
      ? hasDrawing
      : source === 'upload'
        ? file !== null
        : source === 'description'
          ? description.trim().length >= 10
          : description.trim().length >= 3);

  function choose(next: File | undefined) {
    setError(null);
    if (!next) return;
    if (!next.type.startsWith('image/')) {
      setError('Choose an image (JPEG, PNG or WebP).');
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function addChange(change: string) {
    setDescription((text) => {
      const sentence = `${change}.`;
      return text.trim() ? `${text.trim()} ${sentence}` : sentence;
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set('source', source);
      form.set('description', description);
      form.set('notice', agreed ? 'on' : '');
      if (look) {
        form.set('lookId', look.id);
        if (slotId) form.set('slotId', slotId);
      }
      try {
        if (source === 'sketch') {
          const drawn = await pad.current?.exportImage();
          if (!drawn) return setError('Draw your design first.');
          form.set('image', drawn);
        } else if (source === 'upload' && file) {
          form.set('image', await resizePhoto(file, 1600, 0.88));
        }
      } catch {
        return setError('This image can’t be used. Choose a JPEG, PNG or WebP image.');
      }
      const result = await createDesignAction(form);
      if (result.error || !result.designId) return setError(result.error ?? 'Something went wrong. Please try again.');
      router.push(`/design-studio/${result.designId}`);
    });
  }

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-surface p-4 sm:p-6">
      {look ? (
        <section aria-label="The look you are changing" className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-xl text-primary">
            <Shirt aria-hidden className="size-5 text-plum" /> The look you picked
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {look.pieces.map((p) => (
              <li key={p.slotId} className="rounded-xl border border-border bg-[#fbf6ec] px-3 py-2">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {p.swatches.map((s) => (
                    <span
                      key={s.name}
                      title={s.name}
                      className="inline-block size-3 rounded-full border border-border"
                      style={{ backgroundColor: s.hex }}
                    />
                  ))}
                  {p.swatches.map((s) => s.name).join(', ')}
                </p>
                {p.details && <p className="text-xs text-muted-foreground">{p.details}</p>}
              </li>
            ))}
          </ul>
          {look.pieces.length > 1 && (
            <div className="space-y-1">
              <label htmlFor={ids.piece} className="text-sm font-medium">
                What should change?
              </label>
              <select
                id={ids.piece}
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
              >
                <option value="">The whole look</option>
                {look.pieces.map((p) => (
                  <option key={p.slotId} value={p.slotId}>
                    Only the {p.label.toLowerCase()} (keep the rest)
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-plum">Quick changes</p>
            <ul className="flex flex-wrap gap-2">
              {CHANGES.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => addChange(c)}
                    className="rounded-full border border-border bg-[#fbf6ec] px-3 py-1 text-xs hover:border-accent/60"
                  >
                    + {c}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="How to start your design"
            className="flex rounded-full border border-border p-0.5 text-sm"
          >
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => {
                  setMode(id);
                  setError(null);
                }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2',
                  mode === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                <Icon aria-hidden className="size-4" /> {label}
              </button>
            ))}
          </div>

          {/* Kept mounted, so switching tabs doesn't lose the drawing. */}
          <div hidden={mode !== 'sketch'}>
            <SketchPad ref={pad} onChange={setHasDrawing} />
          </div>

          {mode === 'upload' && (
            <div className="space-y-2">
              <label
                htmlFor={ids.file}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  choose(e.dataTransfer.files[0]);
                }}
                className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-plum/40 bg-accent-soft/30 px-4 py-8 text-center hover:border-plum"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                  <img
                    src={preview}
                    alt="Your selected sketch"
                    className="max-h-64 rounded-lg object-contain shadow-sm"
                  />
                ) : (
                  <ImageUp aria-hidden className="size-9 text-plum" />
                )}
                <span className="font-display text-xl text-primary">
                  {preview ? 'Change image' : 'Upload a sketch'}
                </span>
                <span className="text-sm text-muted-foreground">
                  A photo of your paper sketch, or a picture of a garment you like. Not photos of people.
                </span>
              </label>
              <input
                id={ids.file}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="sr-only"
                onChange={(e) => choose(e.target.files?.[0])}
              />
            </div>
          )}
        </>
      )}

      <div className="space-y-1">
        <label htmlFor={ids.description} className="text-sm font-medium">
          {look ? 'Your changes' : mode === 'description' ? 'Describe your idea' : 'Add details (optional)'}
        </label>
        <textarea
          id={ids.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESIGN_DESCRIPTION_MAX}
          rows={look || mode === 'description' ? 5 : 3}
          placeholder={PLACEHOLDER[source]}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <p className="text-right text-[11px] text-muted-foreground">
          {description.length}/{DESIGN_DESCRIPTION_MAX} · Don’t include your measurements or other personal details.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
        <span>
          I agree that StyleMe sends my {look ? 'look and changes' : 'sketch and description'} to Google Gemini to plan
          the design, and a text description of the garment (nothing about me) to an image service (Pollinations or
          Cloudflare) to draw it. My designs are kept privately in my account until I delete them. See the{' '}
          <Link href="/privacy" className="text-plum underline">
            privacy notice
          </Link>
          .
        </span>
      </label>

      <Button type="button" variant="accent" size="full" disabled={!ready} onClick={submit}>
        {pending ? (
          <>
            <Loader2 aria-hidden className="mr-2 size-4 animate-spin" /> Designing your outfit…
          </>
        ) : look ? (
          'Design my changes'
        ) : (
          'Generate my design'
        )}
      </Button>
      <p
        role="status"
        className={cn('min-h-5 text-center text-sm', error ? 'text-destructive' : 'text-muted-foreground')}
      >
        {error ?? (pending ? 'This can take up to a minute. Please keep this page open.' : '')}
      </p>
    </div>
  );
}
