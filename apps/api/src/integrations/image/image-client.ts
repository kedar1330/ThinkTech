import type { DesignImageProvider } from '@styleme/contracts';

// Text-to-image generators for the Design Studio (D-134). Each receives only the garment-only prompt that
// Gemini wrote, never the user's sketch, photos or profile. The service tries them in order: Pollinations
// (FLUX) first, Cloudflare Workers AI (FLUX) when it fails. Prompts and images are never logged.

export type ImageFailure = 'timeout' | 'rate_limited' | 'provider_error' | 'invalid_output';

/** A generator failure with a cause that is safe to log (no prompt or image content). */
export class ImageProviderError extends Error {
  constructor(
    readonly cause: ImageFailure,
    readonly status?: number,
  ) {
    super(`Image provider failed: ${cause}${status ? ` (status ${status})` : ''}`);
    this.name = 'ImageProviderError';
  }
}

export interface GeneratedImage {
  bytes: Buffer;
  contentType: string;
}

export interface ImageGenerator {
  readonly name: DesignImageProvider;
  readonly model: string;
  generate(prompt: string, signal: AbortSignal): Promise<GeneratedImage>;
}

/** Portrait, so the whole garment on the dress form fits. Both FLUX services accept multiples of 32. */
const WIDTH = 768;
const HEIGHT = 1024;

function failureFor(status: number): ImageFailure {
  return status === 429 || status === 402 ? 'rate_limited' : 'provider_error';
}

async function send(fetchImpl: typeof fetch, url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, signal });
  } catch {
    throw new ImageProviderError(signal.aborted ? 'timeout' : 'provider_error');
  }
}

/** Pollinations `GET /image/{prompt}` (gen.pollinations.ai); the reply is the image itself. */
export function pollinationsGenerator(
  apiKey: string,
  model: string,
  baseUrl = 'https://gen.pollinations.ai',
  fetchImpl: typeof fetch = fetch,
): ImageGenerator {
  return {
    name: 'pollinations',
    model,
    async generate(prompt, signal) {
      const query = new URLSearchParams({
        model,
        width: String(WIDTH),
        height: String(HEIGHT),
        seed: String(Math.floor(Math.random() * 2_147_483_647)),
      });
      const res = await send(
        fetchImpl,
        `${baseUrl}/image/${encodeURIComponent(prompt)}?${query.toString()}`,
        { headers: { authorization: `Bearer ${apiKey}` } },
        signal,
      );
      if (!res.ok) throw new ImageProviderError(failureFor(res.status), res.status);
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) throw new ImageProviderError('invalid_output');
      return { bytes: Buffer.from(await res.arrayBuffer()), contentType };
    },
  };
}

/** Cloudflare Workers AI REST `ai/run/{model}`; FLUX-1-schnell replies with JSON holding a base64 JPEG. */
export function cloudflareGenerator(
  accountId: string,
  apiToken: string,
  model: string,
  fetchImpl: typeof fetch = fetch,
): ImageGenerator {
  return {
    name: 'cloudflare',
    model,
    async generate(prompt, signal) {
      const res = await send(
        fetchImpl,
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
          // FLUX-1-schnell: prompt up to 2048 characters, steps up to 8 (no width/height in flux schema).
          body: JSON.stringify({
            prompt: prompt.slice(0, 2048),
            steps: 8,
            ...(model.includes('flux') ? {} : { width: WIDTH, height: HEIGHT }),
          }),
        },
        signal,
      );
      if (!res.ok) throw new ImageProviderError(failureFor(res.status), res.status);
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.startsWith('image/')) return { bytes: Buffer.from(await res.arrayBuffer()), contentType };
      try {
        const body = (await res.json()) as { result?: { image?: string }; image?: string };
        const image = body.result?.image ?? body.image;
        if (typeof image !== 'string' || image.length === 0) throw new Error('no image');
        return { bytes: Buffer.from(image, 'base64'), contentType: 'image/jpeg' };
      } catch {
        throw new ImageProviderError('invalid_output');
      }
    },
  };
}
