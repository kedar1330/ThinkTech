'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ImageUp, Loader2 } from 'lucide-react';
import type { ClothingPreference, PhotoKind } from '@styleme/contracts';
import { uploadPhotoAction } from '@/app/actions/photos';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { resizePhoto } from '@/lib/profile/photo-resize';
import { cn } from '@/lib/utils';

const COPY: Record<PhotoKind, { title: string; analyses: string; sent: string; tips: string[]; maxSide: number }> = {
  face: {
    title: 'Upload your face photo',
    analyses: 'skin tone and undertone',
    sent: 'this photo',
    tips: [
      'Face a window in soft daylight; avoid flash, coloured bulbs and strong shadows.',
      'No filters or beauty mode. Light or no makeup gives the truest result.',
      'Keep your forehead, both cheeks and jawline visible — hair back, glasses off.',
    ],
    maxSide: 1280,
  },
  body: {
    title: 'Upload a full-body photo',
    analyses: 'body type',
    // D-131: the height from the profile goes with the full-body photo, as scale.
    sent: 'this photo and the height in my profile (if I gave one)',
    tips: [
      'Stand straight, facing the camera, visible from head to feet.',
      'Close-fitting clothes (like a fitted tee and leggings or trousers) show your shape best.',
      'Plain background, even light, and only you in the photo.',
    ],
    maxSide: 1600,
  },
};

/**
 * Photo upload for analysis by Gemini Vision AI (D-129): face photo -> skin tone & undertone,
 * full-body photo -> body type proportions.
 * Analysis only triggers when the user clicks the Analyze button.
 */
export function PhotoUpload({
  kind,
  department: _department = 'women',
  onAnalysed,
}: {
  kind: PhotoKind;
  department?: ClothingPreference;
  onAnalysed?: () => void;
}) {
  const copy = COPY[kind];
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function choose(next: File | undefined) {
    setError(null);
    if (!next) return;
    if (!next.type.startsWith('image/')) {
      setError('Choose a photo (JPEG, PNG or WebP).');
      return;
    }
    setFile(next);
    const objectUrl = URL.createObjectURL(next);
    setPreview(objectUrl);
  }

  function analyse() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      let upload: File;
      try {
        upload = await resizePhoto(file, copy.maxSide);
      } catch {
        setError('This photo format can’t be used. Choose a JPEG, PNG or WebP photo.');
        return;
      }
      const form = new FormData();
      form.set('kind', kind);
      form.set('notice', agreed ? 'on' : '');
      form.set('photo', upload);

      const result = await uploadPhotoAction(form);
      if (result.error) {
        setError(result.error);
        return;
      }

      setFile(null);
      setPreview(null);
      onAnalysed?.();
    });
  }

  return (
    <div className="space-y-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          choose(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-plum/40 bg-accent-soft/30 px-4 py-8 text-center transition-colors hover:border-plum',
          dragging && 'border-plum bg-accent-soft/60',
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, never uploaded anywhere else
          <img src={preview} alt="Your selected photo" className="max-h-56 rounded-lg object-contain shadow-sm" />
        ) : (
          <ImageUp aria-hidden className="size-9 text-plum" />
        )}
        <span className="font-display text-xl text-primary">{preview ? 'Change photo' : copy.title}</span>
        <span className="text-sm text-muted-foreground">
          Drag and drop, or choose from your album or device. We’ll analyse your {copy.analyses}.
        </span>
        <span className="inline-flex h-9 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
          {preview ? 'Choose another' : 'Upload'}
        </span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        onChange={(e) => choose(e.target.files?.[0])}
      />

      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {copy.tips.map((t, idx) => (
          <li key={`${t}-${idx}`}>{t}</li>
        ))}
      </ul>

      {file ? (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
            <span>
              I agree that StyleMe sends {copy.sent} to Google Gemini to analyse my {copy.analyses}, and keeps the photo
              privately in my account until I delete it. See the{' '}
              <Link href="/privacy" className="text-plum underline">
                privacy notice
              </Link>
              .
            </span>
          </label>
          <Button type="button" size="full" disabled={!agreed || pending} onClick={analyse}>
            {pending ? (
              <>
                <Loader2 aria-hidden className="animate-spin mr-2 size-4" /> Analysing your photo…
              </>
            ) : (
              `Analyse my ${copy.analyses}`
            )}
          </Button>
          {pending ? (
            <p role="status" className="text-center text-xs text-muted-foreground">
              This can take up to a minute. Please keep this page open.
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
