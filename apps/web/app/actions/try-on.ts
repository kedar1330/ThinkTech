'use server';

import {
  TRY_ON_NOTICE_VERSION,
  drapeViewSchema,
  startDrapeRequestSchema,
  startTryOnRequestSchema,
  type AvatarDepartment,
  type DrapeView,
  type TryOnDrape,
  type TryOnItem,
  type TryOnJob,
  type TryOnOutfitItem,
} from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { BLOCKED, redirectIfSignedOut, sameOrigin, tokenOrLogin } from '@/lib/actions';

// 3D Virtual Try-On (D-137). Starting a try-on sends the user's stored try-on photo and the similar item's
// thumbnail to fal.ai, so it needs the user's agreement to the try-on notice each time. The browser never
// calls the API; the page then polls `/api/try-on/<id>`.

export type StartTryOnResult = { error?: string; job?: TryOnJob };

const SOMETHING_WRONG = 'Something went wrong. Please try again.';
const MESSAGES: Partial<Record<string, string>> = {
  PROVIDER_NOT_CONFIGURED: 'Virtual Try-On is not available right now.',
  RATE_LIMITED: 'You have started several try-ons in a short time. Please wait a few minutes and try again.',
};

function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) return SOMETHING_WRONG;
  // These messages are written for users.
  if (['CONFLICT', 'NOT_FOUND', 'INVALID_REQUEST', 'AI_UNAVAILABLE'].includes(err.code)) return err.message;
  return MESSAGES[err.code] ?? SOMETHING_WRONG;
}

export async function startTryOnAction(input: {
  outfitId: string;
  slotId?: string;
  item?: TryOnItem;
  /** The outfit put together on the 3D mannequin. */
  items?: TryOnOutfitItem[];
  agreed: boolean;
}): Promise<StartTryOnResult> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  if (!input.agreed) return { error: 'Please agree to the try-on notice first.' };
  const parsed = startTryOnRequestSchema.safeParse({
    outfitId: input.outfitId,
    ...(input.slotId ? { slotId: input.slotId } : {}),
    ...(input.item ? { item: input.item } : {}),
    ...(input.items?.length ? { items: input.items } : {}),
    notice: TRY_ON_NOTICE_VERSION,
  });
  if (!parsed.success) return { error: 'This item can’t be tried on. Please go back and pick it again.' };

  const token = await tokenOrLogin();
  try {
    const job = await apiRequest<TryOnJob>('/v1/try-on/jobs', { method: 'POST', token, body: parsed.data });
    return { job };
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: messageFor(err) };
  }
}

/**
 * Dresses the shared cartoon avatar in the outfit (D-138). Nothing about the user is sent (only the avatar and
 * the items' store pictures), so no notice is needed. Takes about 10–20 seconds per garment.
 */
export async function drapeAction(input: {
  outfitId: string;
  department: AvatarDepartment;
  items: TryOnOutfitItem[];
}): Promise<{ error?: string; drape?: TryOnDrape }> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  const parsed = startDrapeRequestSchema.safeParse(input);
  if (!parsed.success) return { error: 'These items can’t be put on the avatar. Please pick them again.' };
  const token = await tokenOrLogin();
  try {
    return { drape: await apiRequest<TryOnDrape>('/v1/try-on/drapes', { method: 'POST', token, body: parsed.data }) };
  } catch (err) {
    redirectIfSignedOut(err);
    if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
      return { error: 'You have dressed the avatar many times in a short while. Please wait a minute and try again.' };
    }
    if (err instanceof ApiError && err.code === 'PROVIDER_NOT_CONFIGURED') {
      return { error: 'The cartoon avatar isn’t available right now.' };
    }
    return { error: messageFor(err) };
  }
}

/** Draws one more angle (three-quarter, side or back) of a dressed model (D-139); about 15 seconds. */
export async function drapeViewAction(
  drapeId: string,
  view: Exclude<DrapeView, 'front'>,
): Promise<{ error?: string; ok?: true }> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  if (!/^[a-f0-9]{24}$/.test(drapeId) || !drapeViewSchema.exclude(['front']).safeParse(view).success) {
    return { error: 'Please try again.' };
  }
  const token = await tokenOrLogin();
  try {
    await apiRequest<TryOnDrape>(`/v1/try-on/drapes/${drapeId}/views/${view}`, { method: 'POST', token });
    return { ok: true };
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: messageFor(err) };
  }
}

export async function deleteTryOnAction(jobId: string): Promise<{ error?: string }> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  if (!/^[a-f0-9]{24}$/.test(jobId)) return { error: 'Please try again.' };
  const token = await tokenOrLogin();
  try {
    await apiRequest(`/v1/try-on/jobs/${jobId}`, { method: 'DELETE', token });
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: messageFor(err) };
  }
  return {};
}
