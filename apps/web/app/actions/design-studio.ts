'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  DESIGN_IMAGE_MAX_BYTES,
  DESIGN_NOTICE_VERSION,
  DESIGN_REQUEST_CONTENT_TYPE,
  PHOTO_CONTENT_TYPES,
  createDesignRequestSchema,
  type Design,
} from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { BLOCKED, redirectIfSignedOut, str, tokenOrLogin, sameOrigin } from '@/lib/actions';

// Design Studio (D-134). The browser shrinks the sketch; this action forwards it with the description to
// the API (the browser never calls the API), which designs it with Gemini and draws it with FLUX.

export type DesignActionResult = { error?: string; designId?: string };

const SOMETHING_WRONG = 'Something went wrong. Please try again.';
const MESSAGES: Partial<Record<string, string>> = {
  PROVIDER_NOT_CONFIGURED: 'Design Studio is not available right now.',
  RATE_LIMITED: 'You have made several designs in a short time. Please wait a few minutes and try again.',
};

function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) return SOMETHING_WRONG;
  // These messages are written for users.
  if (['DESIGN_UNUSABLE', 'CONFLICT', 'NOT_FOUND', 'INVALID_REQUEST', 'AI_UNAVAILABLE'].includes(err.code)) {
    return err.message;
  }
  return MESSAGES[err.code] ?? SOMETHING_WRONG;
}

export async function createDesignAction(formData: FormData): Promise<DesignActionResult> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  if (formData.get('notice') !== 'on') return { error: 'Please agree to the Design Studio notice first.' };

  const image = formData.get('image');
  let encoded: { contentType: (typeof PHOTO_CONTENT_TYPES)[number]; base64: string } | undefined;
  if (image instanceof File && image.size > 0) {
    if (image.size > DESIGN_IMAGE_MAX_BYTES || !(PHOTO_CONTENT_TYPES as readonly string[]).includes(image.type)) {
      return { error: 'Choose a JPEG, PNG or WebP image under 4 MB.' };
    }
    encoded = {
      contentType: image.type as (typeof PHOTO_CONTENT_TYPES)[number],
      base64: Buffer.from(await image.arrayBuffer()).toString('base64'),
    };
  }
  const parsed = createDesignRequestSchema.safeParse({
    source: str(formData, 'source'),
    description: str(formData, 'description'),
    ...(encoded ? { image: encoded } : {}),
    ...(str(formData, 'lookId') ? { lookId: str(formData, 'lookId') } : {}),
    ...(str(formData, 'slotId') ? { slotId: str(formData, 'slotId') } : {}),
    notice: DESIGN_NOTICE_VERSION,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Please check your design and try again.' };
  }

  const token = await tokenOrLogin();
  let design: Design;
  try {
    design = await apiRequest<Design>('/v1/design-studio/designs', {
      method: 'POST',
      token,
      body: parsed.data,
      headers: { 'content-type': DESIGN_REQUEST_CONTENT_TYPE },
    });
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: messageFor(err) };
  }
  revalidatePath('/design-studio');
  return { designId: design.id };
}

/** Draws the design's picture again (after a failure, or for another variation). */
export async function renderDesignAction(designId: string): Promise<{ error?: string; success?: string }> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  if (!/^[a-f0-9]{24}$/.test(designId)) return { error: 'Please try again.' };
  const token = await tokenOrLogin();
  try {
    await apiRequest(`/v1/design-studio/designs/${designId}/render`, { method: 'POST', token });
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: messageFor(err) };
  }
  revalidatePath(`/design-studio/${designId}`);
  revalidatePath('/design-studio');
  return { success: 'New picture ready.' };
}

export async function deleteDesignAction(designId: string): Promise<{ error?: string }> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  if (!/^[a-f0-9]{24}$/.test(designId)) return { error: 'Please try again.' };
  const token = await tokenOrLogin();
  try {
    await apiRequest(`/v1/design-studio/designs/${designId}`, { method: 'DELETE', token });
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: messageFor(err) };
  }
  revalidatePath('/design-studio');
  redirect('/design-studio?deleted=1');
}
