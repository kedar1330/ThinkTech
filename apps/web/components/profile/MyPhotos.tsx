'use client';

import { useState, useTransition } from 'react';
import type { UserPhoto } from '@styleme/contracts';
import { deletePhotoAction } from '@/app/actions/photos';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const KIND_LABEL: Record<UserPhoto['kind'], string> = {
  face: 'Face photo (skin tone and undertone)',
  body: 'Full-body photo (body type, try-on)',
};

/** The user's stored photos, each shown back to them with a delete button (D-129). */
export function MyPhotos({ photos }: { photos: UserPhoto[] }) {
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  if (photos.length === 0) return null;
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border rounded-xl border border-border">
        {photos.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- private photo served by our own route handler, never cached */}
            <img
              src={`/api/photos/${p.id}/image`}
              alt={p.kind === 'face' ? 'Your face photo' : 'Your full-body photo'}
              className="h-20 w-16 rounded-lg border border-border object-cover"
            />
            <span className="flex-1">
              <span className="font-medium">{KIND_LABEL[p.kind]}</span>
              <span className="block text-xs text-muted-foreground">
                Uploaded {new Date(p.uploadedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · kept privately
                until you delete it
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => startTransition(async () => setMessage(await deletePhotoAction(p.id)))}
            >
              Delete photo
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Deleting a photo keeps the result already saved; change or clear the result above at any time.
      </p>
      {message?.error ? <Alert tone="error">{message.error}</Alert> : null}
      {message?.success ? <Alert tone="success">{message.success}</Alert> : null}
    </div>
  );
}
