import { ImageProviderError, type GeneratedImage } from './image-client';

// Image editing for the cartoon avatar drape (D-138): the avatar picture and one store thumbnail go to
// Pollinations' OpenAI-compatible `POST /v1/images/edits`, and the edited picture comes back as base64. Only
// models Pollinations offers without paid Pollen are configured (`paid_only: false`). The models are tried in
// order. Pictures, prompts and replies are never logged.

export interface EditedImage extends GeneratedImage {
  model: string;
}

export interface ImageEditor {
  readonly name: 'pollinations';
  readonly models: readonly string[];
  /** `images`: https URLs or data URIs; the first is the picture to edit, the rest are references. */
  edit(input: { prompt: string; images: readonly string[] }, signal: AbortSignal): Promise<EditedImage>;
}

/** Portrait, like the avatar. */
const SIZE = '768x1024';

export function pollinationsImageEditor(
  apiKey: string,
  models: readonly string[],
  baseUrl = 'https://gen.pollinations.ai',
  fetchImpl: typeof fetch = fetch,
): ImageEditor {
  async function once(model: string, prompt: string, images: readonly string[], signal: AbortSignal) {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}/v1/images/edits`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          image: images.map((url) => ({ image_url: url })),
          size: SIZE,
          response_format: 'b64_json',
        }),
        signal,
      });
    } catch {
      throw new ImageProviderError(signal.aborted ? 'timeout' : 'provider_error');
    }
    if (!res.ok)
      throw new ImageProviderError(
        res.status === 429 || res.status === 402 ? 'rate_limited' : 'provider_error',
        res.status,
      );
    let b64: unknown;
    try {
      b64 = ((await res.json()) as { data?: Array<{ b64_json?: unknown }> }).data?.[0]?.b64_json;
    } catch {
      throw new ImageProviderError(signal.aborted ? 'timeout' : 'invalid_output');
    }
    if (typeof b64 !== 'string' || b64.length === 0) throw new ImageProviderError('invalid_output');
    return Buffer.from(b64, 'base64');
  }

  return {
    name: 'pollinations',
    models,
    async edit({ prompt, images }, signal) {
      let last: unknown = new ImageProviderError('provider_error');
      for (const model of models) {
        try {
          // The service checks the picture's signature and sets the content type.
          return { bytes: await once(model, prompt, images, signal), contentType: '', model };
        } catch (err) {
          last = err;
          // Out of time: the next model would be too.
          if (signal.aborted) break;
        }
      }
      throw last;
    },
  };
}
