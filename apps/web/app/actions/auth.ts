'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError, CredentialsSignin } from 'next-auth';
import {
  AUTH_MESSAGES,
  changePasswordRequestSchema,
  deleteAccountRequestSchema,
  registerRequestSchema,
  resetConfirmRequestSchema,
  resetRequestRequestSchema,
} from '@styleme/contracts';
import { signIn, signOut, unstable_update } from '@/auth';
import { ApiError, apiRequest } from '@/lib/api/server';
import { clientIpFrom, isAllowedOrigin } from '@/lib/auth/origin';
import { getAccessToken } from '@/lib/auth/session';

// State-changing auth actions. Each one first checks the request's Origin (SECURITY.md §1); Next.js
// server actions are POST-only.

export type FormState = { error?: string; success?: string } | undefined;

const BLOCKED: FormState = { error: 'This request was blocked. Please reload the page and try again.' };
const UNAVAILABLE = 'Something went wrong. Please try again.';

async function sameOrigin(): Promise<boolean> {
  return isAllowedOrigin((await headers()).get('origin'), process.env.AUTH_URL);
}

async function clientIp(): Promise<string | undefined> {
  return clientIpFrom(await headers());
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'INVALID_REQUEST' || err.code === 'FORBIDDEN' || err.code === 'PASSWORD_INCORRECT')
      return err.message;
    if (err.code === 'RATE_LIMITED') return 'Too many attempts — please wait and try again.';
  }
  return UNAVAILABLE;
}

async function signInWithPassword(email: string, password: string): Promise<FormState> {
  try {
    await signIn('credentials', { email, password, redirect: false });
    return undefined;
  } catch (err) {
    if (err instanceof CredentialsSignin && err.code === 'rate_limited') {
      return { error: 'Too many attempts — please wait a minute and try again.' };
    }
    if (err instanceof AuthError) return { error: AUTH_MESSAGES.loginFailed };
    throw err;
  }
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const failed = await signInWithPassword(String(formData.get('email') ?? ''), String(formData.get('password') ?? ''));
  if (failed) return failed;
  redirect('/dashboard');
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = registerRequestSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { error: 'Enter your name, a valid email and a password of at least 8 characters.' };
  try {
    await apiRequest('/v1/auth/register', { method: 'POST', body: parsed.data, clientIp: await clientIp() });
  } catch (err) {
    return { error: messageFor(err) };
  }
  const failed = await signInWithPassword(parsed.data.email, parsed.data.password);
  if (failed) redirect('/login');
  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  if (!(await sameOrigin())) return;
  await signOut({ redirectTo: '/login' });
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await getAccessToken();
  if (!token) redirect('/login');
  if (formData.get('newPassword') !== formData.get('confirmPassword'))
    return { error: 'The new passwords do not match.' };
  const parsed = changePasswordRequestSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) return { error: 'The new password must be at least 8 characters.' };
  try {
    const { accessToken } = await apiRequest<{ accessToken: string }>('/v1/auth/password', {
      method: 'PUT',
      body: parsed.data,
      token,
    });
    // Every other session is now revoked; keep this browser signed in with the new token.
    await unstable_update({ accessToken });
  } catch (err) {
    return { error: messageFor(err) };
  }
  return { success: 'Your password has been changed. You have been signed out everywhere else.' };
}

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await getAccessToken();
  if (!token) redirect('/login');
  const parsed = deleteAccountRequestSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) return { error: 'Enter your password to confirm.' };
  try {
    await apiRequest('/v1/account', { method: 'DELETE', body: parsed.data, token });
  } catch (err) {
    return { error: messageFor(err) };
  }
  await signOut({ redirectTo: '/?deleted=1' });
  return undefined;
}

export async function resetConfirmAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  if (formData.get('newPassword') !== formData.get('confirmPassword'))
    return { error: 'The new passwords do not match.' };
  const parsed = resetConfirmRequestSchema.safeParse({
    token: String(formData.get('token') ?? '').trim(),
    newPassword: formData.get('newPassword'),
  });
  if (!parsed.success) return { error: 'Enter your reset code and a new password of at least 8 characters.' };
  try {
    await apiRequest('/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: parsed.data,
      clientIp: await clientIp(),
    });
  } catch (err) {
    return { error: messageFor(err) };
  }
  return { success: 'Your password has been reset. You can now log in with your new password.' };
}

export async function resetRequestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = resetRequestRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  try {
    await apiRequest('/v1/auth/password-reset/request', {
      method: 'POST',
      body: parsed.data,
      clientIp: await clientIp(),
    });
  } catch (err) {
    return { error: messageFor(err) };
  }
  return { success: 'If an account exists for this email, we have sent a reset link. It is valid for 30 minutes.' };
}
