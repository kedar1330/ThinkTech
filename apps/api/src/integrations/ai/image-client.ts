// Outfit image provider. The service talks to the `OutfitImageProvider` interface only;
// tests inject a fake through AppDeps, so CI needs no key. The prompt describes garments, colours and the
// occasion only; nothing about the user (AI rule 16). Nothing from the request or reply is logged.

export type ImageFailure = 'timeout' | 'rate_limited' | 'budget_exhausted' | 'provider_error' | 'invalid_output';

/** A provider failure with a cause that is safe to log (no request or response content). */
export class ImageProviderError extends Error {
  constructor(readonly cause: ImageFailure) {
    super(`Outfit image provider failed: ${cause}`);
    this.name = 'ImageProviderError';
  }
}

export type GeneratedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface GeneratedImage {
  bytes: Buffer;
  contentType: GeneratedImageType;
}

export interface ImageRequest {
  prompt: string;
  width: number;
  height: number;
  /** Same prompt + seed = the same picture, where the model honours seeds. */
  seed: number;
}

export interface OutfitImageProvider {
  readonly name: string;
  readonly model: string;
  generate(request: ImageRequest, signal: AbortSignal): Promise<GeneratedImage>;
}

const POLLINATIONS_URL = 'https://gen.pollinations.ai/image';
/** Raster types only: an SVG reply could carry script, so it is never accepted. */
const IMAGE_TYPES: readonly GeneratedImageType[] = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Pollinations `GET /image/{prompt}` with the secret key in the header, server-side only. */
export function pollinationsImageProvider(
  apiKey: string,
  model: string,
  fetchImpl: typeof fetch = fetch,
): OutfitImageProvider {
  return {
    name: 'pollinations',
    model,
    async generate({ prompt, width, height, seed }, signal) {
      const query = new URLSearchParams({
        model,
        width: String(width),
        height: String(height),
        seed: String(seed),
        safe: 'true',
      });
      let res: Response;
      try {
        res = await fetchImpl(`${POLLINATIONS_URL}/${encodeURIComponent(prompt)}?${query.toString()}`, {
          headers: { authorization: `Bearer ${apiKey}` },
          signal,
        });
      } catch {
        throw new ImageProviderError(signal.aborted ? 'timeout' : 'provider_error');
      }
      if (res.status === 429 || res.status === 503) throw new ImageProviderError('rate_limited');
      if (res.status === 402) throw new ImageProviderError('budget_exhausted');
      if (!res.ok) throw new ImageProviderError('provider_error');
      const contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim() as GeneratedImageType;
      if (!IMAGE_TYPES.includes(contentType)) throw new ImageProviderError('invalid_output');
      let bytes: Buffer;
      try {
        bytes = Buffer.from(await res.arrayBuffer());
      } catch {
        throw new ImageProviderError(signal.aborted ? 'timeout' : 'provider_error');
      }
      if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new ImageProviderError('invalid_output');
      return { bytes, contentType };
    },
  };
}
