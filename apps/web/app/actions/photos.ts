'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  PHOTO_CONTENT_TYPES,
  PHOTO_MAX_BYTES,
  PHOTO_NOTICE_VERSION,
  photoKindSchema,
  type AppearanceAnalysisSummary,
  type PhotoAnalysisResponse,
  type UserPhoto,
} from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { BLOCKED, sameOrigin } from '@/lib/actions';
import { getAccessToken } from '@/lib/auth/session';

// Profile photos analysed by Gemini (D-129). The browser shrinks the photo, this action forwards the bytes to
// the API (the browser never calls the API), and the analysis result comes back at once.

export type PhotoActionResult = { error?: string; analysis?: AppearanceAnalysisSummary };

const MESSAGES: Partial<Record<string, string>> = {
  PROVIDER_NOT_CONFIGURED: 'Photo analysis is not available right now. You can choose manually instead.',
  RATE_LIMITED: 'You have uploaded several photos in a short time. Please wait a few minutes and try again.',
};

export async function uploadPhotoAction(formData: FormData): Promise<PhotoActionResult> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  const kind = photoKindSchema.safeParse(formData.get('kind'));
  const photo = formData.get('photo');
  if (!kind.success) return { error: 'Please try again.' };
  if (formData.get('notice') !== 'on') return { error: 'Please agree to the photo notice first.' };
  if (
    !(photo instanceof File) ||
    photo.size === 0 ||
    photo.size > PHOTO_MAX_BYTES ||
    !(PHOTO_CONTENT_TYPES as readonly string[]).includes(photo.type)
  ) {
    return { error: 'Choose a JPEG, PNG or WebP photo under 8 MB.' };
  }

  const token = await getAccessToken();
  if (!token) redirect('/login');

  let result: PhotoAnalysisResponse;
  try {
    result = await apiRequest<PhotoAnalysisResponse>(
      `/v1/photos?kind=${kind.data}&notice=${encodeURIComponent(PHOTO_NOTICE_VERSION)}`,
      {
        method: 'POST',
        token,
        rawBody: { bytes: new Uint8Array(await photo.arrayBuffer()), contentType: photo.type },
      },
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    if (err instanceof ApiError) {
      // PHOTO_UNUSABLE, CONFLICT and INVALID_REQUEST messages are written for users.
      if (['PHOTO_UNUSABLE', 'CONFLICT', 'INVALID_REQUEST', 'AI_UNAVAILABLE'].includes(err.code)) {
        return { error: err.message };
      }
      return { error: MESSAGES[err.code] ?? 'Something went wrong. Please try again.' };
    }
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath('/profile');
  revalidatePath('/onboarding/appearance');
  revalidatePath('/home');
  return { analysis: result.analysis };
}

export async function deletePhotoAction(photoId: string): Promise<{ error?: string; success?: string }> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  if (!/^[a-f0-9]{24}$/.test(photoId)) return { error: 'Please try again.' };
  const token = await getAccessToken();
  if (!token) redirect('/login');
  try {
    await apiRequest(`/v1/photos/${photoId}`, { method: 'DELETE', token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath('/profile');
  return { success: 'Photo deleted.' };
}

export async function uploadTryOnPhotoAction(formData: FormData): Promise<{ error?: string; photo?: UserPhoto }> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  const photo = formData.get('photo');
  if (
    !(photo instanceof File) ||
    photo.size === 0 ||
    photo.size > PHOTO_MAX_BYTES ||
    !(PHOTO_CONTENT_TYPES as readonly string[]).includes(photo.type)
  ) {
    return { error: 'Choose a JPEG, PNG or WebP photo under 8 MB.' };
  }

  const token = await getAccessToken();
  if (!token) redirect('/login');

  let result: UserPhoto;
  try {
    result = await apiRequest<UserPhoto>('/v1/photos/try-on', {
      method: 'POST',
      token,
      rawBody: { bytes: new Uint8Array(await photo.arrayBuffer()), contentType: photo.type },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath('/profile');
  return { photo: result };
}
