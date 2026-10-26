import { ImageProviderError, type GeneratedImage } from './image-client';

// Image editing for the cartoon avatar drape (D-138): the avatar picture and one store thumbnail go to
// Pollinations' OpenAI-compatible `POST /v1/images/edits`, and the edited picture comes back as base64. Only
// models Pollinations offers without paid Pollen are configured (`paid_only: false`). The models are tried in
// order. Pictures, prompts and replies are never logged.

export interface EditedImage extends GeneratedImage {
  model: string;
}

export interface ImageEditor {
  readonly name: string;
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
        res.status === 429 ? 'rate_limited' : 'provider_error',
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

export function formatFluxDrapePrompt(prompt: string): string {
  if (prompt.startsWith('Photorealistic studio fashion shoot') || prompt.startsWith('Photorealistic full-body studio')) {
    return prompt;
  }

  let angle = 'standing straight facing the camera directly, relaxed posture, arms gently at sides';
  if (/three_quarter|turned about 45 degrees|three-quarter/i.test(prompt)) {
    angle = 'turned 45 degrees to her left in a three-quarter pose showing front and right side of the gown';
  } else if (/\bside\b|turned 90 degrees|profile/i.test(prompt)) {
    angle = 'turned 90 degrees to her left in a full side profile pose showing the ballgown silhouette';
  } else if (/back view|directly behind|turned around/i.test(prompt)) {
    angle = 'turned around facing directly away from camera, showing the back of the dress corset and tiered ruffles';
  }

  const isMan = /\b(young Indian man|men's|menswear)\b/i.test(prompt);
  const defaultPerson = isMan ? 'a young Indian man' : 'a young Indian woman';
  const footwear = isMan ? 'white sneakers' : 'elegant white heels';

  let modelDesc = defaultPerson;
  const modelMatch = prompt.match(/Model:\s*([\s\S]+?)(?:\.\s*(?:Replace|wearing|Keep|Same|Full body|\n|$)|$)/i);
  if (modelMatch?.[1]) {
    modelDesc = modelMatch[1].replace(/\.+$/, '').trim();
  }

  let garment = 'an elegant stylish outfit';
  const specificMatch = prompt.match(/The specific garment is:\s*([\s\S]+?)\.\s*Match this exact/i);
  const fallbackMatch = prompt.match(/The specific garment is:\s*([^.]+)\./i);
  const parenMatch = prompt.match(/wearing exactly the same outfit\s*\(([\s\S]+?)\)/i);

  if (specificMatch?.[1]) {
    garment = specificMatch[1].trim();
  } else if (fallbackMatch?.[1]) {
    garment = fallbackMatch[1].trim();
  } else if (parenMatch?.[1]) {
    garment = parenMatch[1].trim();
  }

  return `Photorealistic full-body studio fashion shoot of ${modelDesc}, ${angle}, wearing ${garment}, ${footwear}. Dark purple-grey studio backdrop with soft floor shadow, professional soft studio turntable lighting, whole body visible from head to feet, product turntable style, 8k, sharp focus, photorealistic fashion photography, no text, no logos`;
}

export function cloudflareImageEditor(
  accountId: string,
  apiToken: string,
  model = '@cf/black-forest-labs/flux-1-schnell',
  fetchImpl: typeof fetch = fetch,
): ImageEditor {
  return {
    name: 'cloudflare',
    models: [model],
    async edit({ prompt }, signal) {
      const fluxPrompt = formatFluxDrapePrompt(prompt);
      let res: Response;
      try {
        res = await fetchImpl(
          `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
          {
            method: 'POST',
            headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
            body: JSON.stringify({ prompt: fluxPrompt.slice(0, 2048), steps: 8 }),
            signal,
          },
        );
      } catch {
        throw new ImageProviderError(signal.aborted ? 'timeout' : 'provider_error');
      }
      if (!res.ok) throw new ImageProviderError(res.status === 429 ? 'rate_limited' : 'provider_error', res.status);
      try {
        const body = (await res.json()) as { result?: { image?: string }; image?: string };
        const image = body.result?.image ?? body.image;
        if (typeof image !== 'string' || image.length === 0) throw new Error('no image');
        return { bytes: Buffer.from(image, 'base64'), contentType: 'image/jpeg', model };
      } catch {
        throw new ImageProviderError('invalid_output');
      }
    },
  };
}

export function compositeImageEditor(editors: readonly ImageEditor[]): ImageEditor {
  return {
    name: editors[0]?.name ?? 'composite',
    models: editors.flatMap((e) => e.models),
    async edit(input, signal) {
      let last: unknown = new ImageProviderError('provider_error');
      for (const editor of editors) {
        try {
          return await editor.edit(input, signal);
        } catch (err) {
          last = err;
          if (signal.aborted) break;
        }
      }
      throw last;
    },
  };
}
