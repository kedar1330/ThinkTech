'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { Camera, CheckCircle2, ImageUp, Loader2, Sparkles, UserCheck } from 'lucide-react';
import type { ProfileResponse, TryOnModel, UserPhoto } from '@styleme/contracts';
import { deletePhotoAction, uploadTryOnPhotoAction } from '@/app/actions/photos';
import { saveTryOnModelAction } from '@/app/actions/profile';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { resizePhoto } from '@/lib/profile/photo-resize';
import { cn } from '@/lib/utils';

/**
 * 3D Virtual Try-On Model Choice (custom_photo | dummy_model).
 * Stores the user's preference and optional photo for the 3D model generator collaborator.
 */
export function VirtualTryOnSection({ profile, photos }: { profile: ProfileResponse; photos: UserPhoto[] }) {
  const existingBodyPhoto = photos.find((p) => p.kind === 'body');
  const [selectedModel, setSelectedModel] = useState<TryOnModel>(
    profile.tryOnModel ?? (existingBodyPhoto ? 'custom_photo' : 'dummy_model'),
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [replacingPhoto, setReplacingPhoto] = useState(!existingBodyPhoto);
  const [status, setStatus] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function handleModelSelect(choice: TryOnModel) {
    setSelectedModel(choice);
    setStatus(null);
    if (choice === 'dummy_model') {
      startTransition(async () => {
        const res = await saveTryOnModelAction('dummy_model');
        setStatus(res ? { error: res.error, success: res.success } : null);
      });
    }
  }

  function handleFileSelect(next: File | undefined) {
    setStatus(null);
    if (!next) return;
    if (!next.type.startsWith('image/')) {
      setStatus({ error: 'Please choose an image photo (JPEG, PNG or WebP).' });
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  function handleUploadPhoto() {
    if (!file) return;
    setStatus(null);
    startTransition(async () => {
      let uploadFile: File;
      try {
        uploadFile = await resizePhoto(file, 1600);
      } catch {
        setStatus({ error: 'Could not process photo format. Please select JPEG, PNG or WebP.' });
        return;
      }

      const form = new FormData();
      form.set('photo', uploadFile);

      const res = await uploadTryOnPhotoAction(form);
      if (res.error) {
        setStatus({ error: res.error });
        return;
      }

      // Also ensure profile tryOnModel is saved as custom_photo
      await saveTryOnModelAction('custom_photo');
      setSelectedModel('custom_photo');
      setFile(null);
      setPreview(null);
      setReplacingPhoto(false);
      setStatus({ success: 'Photo saved successfully for your 3D model.' });
    });
  }

  function handleDeletePhoto(photoId: string) {
    setStatus(null);
    startTransition(async () => {
      const res = await deletePhotoAction(photoId);
      if (res.error) {
        setStatus({ error: res.error });
      } else {
        setReplacingPhoto(true);
        setStatus({ success: 'Photo deleted. You can upload a new one or use the dummy model.' });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="3D Virtual Try-On Model Option" className="grid gap-3 sm:grid-cols-2">
        {/* Option 1: Upload Photo for Personalized 3D Model */}
        <button
          type="button"
          role="radio"
          aria-checked={selectedModel === 'custom_photo'}
          onClick={() => handleModelSelect('custom_photo')}
          className={cn(
            'flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-all hover:border-plum/60',
            selectedModel === 'custom_photo'
              ? 'border-plum bg-accent-soft/50 ring-2 ring-plum/40'
              : 'border-input bg-surface',
          )}
        >
          <div className="flex w-full items-center justify-between">
            <span className="flex items-center gap-2 font-display text-base text-primary">
              <Camera className="size-5 text-plum" />
              Upload your photo
            </span>
            {selectedModel === 'custom_photo' ? (
              <span className="flex items-center gap-1 rounded-full bg-plum/10 px-2 py-0.5 text-xs font-semibold text-plum">
                <CheckCircle2 className="size-3.5" /> Selected
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Upload your photo so our 3D engine can create a personalized 3D avatar of you to try on clothes.
          </p>
        </button>

        {/* Option 2: Try on standard Dummy Model */}
        <button
          type="button"
          role="radio"
          aria-checked={selectedModel === 'dummy_model'}
          onClick={() => handleModelSelect('dummy_model')}
          className={cn(
            'flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-all hover:border-plum/60',
            selectedModel === 'dummy_model'
              ? 'border-plum bg-accent-soft/50 ring-2 ring-plum/40'
              : 'border-input bg-surface',
          )}
        >
          <div className="flex w-full items-center justify-between">
            <span className="flex items-center gap-2 font-display text-base text-primary">
              <Sparkles className="size-5 text-plum" />
              Try on dummy model
            </span>
            {selectedModel === 'dummy_model' ? (
              <span className="flex items-center gap-1 rounded-full bg-plum/10 px-2 py-0.5 text-xs font-semibold text-plum">
                <CheckCircle2 className="size-3.5" /> Selected
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Preview outfits on our standard 3D dummy mannequin matching your clothing preference. No photo needed.
          </p>
        </button>
      </div>

      {/* Detail panel when "custom_photo" is selected */}
      {selectedModel === 'custom_photo' ? (
        <div className="rounded-xl border border-plum/20 bg-surface p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <UserCheck className="size-4 text-plum" />
            <span>Personalized 3D Model Setup</span>
          </div>

          {existingBodyPhoto && !replacingPhoto ? (
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-accent-soft/30 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${existingBodyPhoto.id}/image`}
                alt="Your 3D model reference photo"
                className="h-24 w-20 rounded-md border border-border object-cover shadow-sm"
              />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">Current 3D Model Reference Photo</p>
                <p className="text-xs text-muted-foreground">
                  Uploaded on{' '}
                  {new Date(existingBodyPhoto.uploadedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · Ready
                  for 3D model generation
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setReplacingPhoto(true)}
                  >
                    Change photo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={pending}
                    onClick={() => handleDeletePhoto(existingBodyPhoto.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
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
                  handleFileSelect(e.dataTransfer.files[0]);
                }}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-plum/40 bg-accent-soft/30 px-4 py-6 text-center transition-colors hover:border-plum',
                  dragging && 'border-plum bg-accent-soft/60',
                )}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Selected photo" className="max-h-48 rounded-lg object-contain shadow-sm" />
                ) : (
                  <ImageUp aria-hidden className="size-8 text-plum" />
                )}
                <span className="font-display text-lg text-primary">
                  {preview ? 'Change selected photo' : 'Upload photo for your 3D model'}
                </span>
                <span className="text-xs text-muted-foreground">
                  Drag and drop, or choose from your device (JPEG, PNG, or WebP). Visible from head to feet works best.
                </span>
                <span className="inline-flex h-8 items-center rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground">
                  {preview ? 'Choose different photo' : 'Select photo'}
                </span>
              </label>

              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="sr-only"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />

              <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                <li>Stand straight facing the camera with your full body visible.</li>
                <li>Close-fitting clothes help create the most accurate 3D model.</li>
                <li>Your photo is saved privately in your account and can be deleted anytime.</li>
              </ul>

              {file ? (
                <div className="flex gap-2 pt-2">
                  <Button type="button" size="full" disabled={pending} onClick={handleUploadPhoto}>
                    {pending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" /> Saving photo for 3D model…
                      </>
                    ) : (
                      'Save photo for 3D Virtual Try-On'
                    )}
                  </Button>
                  {existingBodyPhoto ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                        setReplacingPhoto(false);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Standard 3D Dummy Model Active</p>
            <p className="text-xs text-muted-foreground">
              Outfits will be previewed on the standard mannequin tailored to your clothing preference (
              {profile.department ?? 'default'}).
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
            Active
          </span>
        </div>
      )}

      {status?.error ? <Alert tone="error">{status.error}</Alert> : null}
      {status?.success ? <Alert tone="success">{status.success}</Alert> : null}
    </div>
  );
}
