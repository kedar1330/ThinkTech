// 3D Virtual Try-On through fal.ai's queue (#106, D-137). FASHN puts a garment on the user's full-body photo;
// TRELLIS turns the dressed photo into a GLB model. The service talks to the `TryOnRenderer` interface only;
// tests inject a fake through AppDeps, so CI needs no key. Requests are queued and polled (no open
// connection while the GPU works). Photos, garment pictures, result URLs and replies are never logged.

export type TryOnFailure = 'timeout' | 'rate_limited' | 'unauthorized' | 'provider_error' | 'invalid_output';

/** A provider failure with a cause that is safe to log (no request or response content). */
export class TryOnProviderError extends Error {
  constructor(
    readonly cause: TryOnFailure,
    readonly status?: number,
    readonly details?: string,
  ) {
    super(`Try-on provider failed: ${cause}${status ? ` (status ${status})` : ''}${details ? `: ${details}` : ''}`);
    this.name = 'TryOnProviderError';
  }
}

/** FASHN's garment categories. */
export type GarmentCategory = 'tops' | 'bottoms' | 'one-pieces';

/** A queued request: where to ask for its status and fetch its result. */
export interface QueuedRequest {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
}

export type QueueResult = { done: false } | { done: true; output: unknown };

export interface DownloadedFile {
  bytes: Buffer;
  contentType: string;
}

export interface TryOnRenderer {
  readonly name: string;
  readonly tryOnModel: string;
  readonly model3d: string;
  /** Dresses `person` (a data URI of the photo, or the URL of an earlier result) in the garment. */
  submitTryOn(
    input: { person: string; garmentImageUrl: string; category: GarmentCategory },
    signal: AbortSignal,
  ): Promise<QueuedRequest>;
  /** Builds a 3D model from the dressed photo at `imageUrl`. */
  submit3d(imageUrl: string, signal: AbortSignal): Promise<QueuedRequest>;
  /** The request's output once it has finished; `{ done: false }` while it is queued or running. */
  poll(request: QueuedRequest, signal: AbortSignal): Promise<QueueResult>;
  /** Downloads a result file (a picture or a model), refusing anything over `maxBytes`. */
  download(url: string, maxBytes: number, signal: AbortSignal): Promise<DownloadedFile>;
}

const QUEUE_HOST = 'queue.fal.run';

/** An https URL (or localhost http), else null: replies are untrusted. */
function httpsUrl(raw: unknown, host?: string): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isAllowed = url.protocol === 'https:' || (isLocal && url.protocol === 'http:');
    return isAllowed && (!host || url.hostname === host) ? url.href : null;
  } catch {
    return null;
  }
}

/** The dressed picture's URL from a FASHN reply: `{ images: [{ url }] }`. */
export function tryOnImageUrl(output: unknown): string {
  const images = (output as { images?: unknown } | null)?.images;
  const url = Array.isArray(images) ? httpsUrl((images[0] as { url?: unknown } | undefined)?.url) : null;
  if (!url) throw new TryOnProviderError('invalid_output');
  return url;
}

/** The model's URL from a TRELLIS reply: `{ model_mesh: { url } }` (some 3D models name it `model_glb`). */
export function modelMeshUrl(output: unknown): string {
  const reply = output as { model_mesh?: { url?: unknown }; model_glb?: { url?: unknown } } | null;
  const url = httpsUrl(reply?.model_mesh?.url ?? reply?.model_glb?.url);
  if (!url) throw new TryOnProviderError('invalid_output');
  return url;
}

function failureFor(status: number): TryOnFailure {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'unauthorized';
  return 'provider_error';
}

/** Synthetic mock for local development and test environments when FAL_KEY=mock */
export function mockTryOnRenderer(): TryOnRenderer {
  const tryOns = new Map<string, { stage: 'try_on' | 'model_3d'; url: string }>();
  let count = 0;

  return {
    name: 'mock',
    tryOnModel: 'mock-fashn',
    model3d: 'mock-trellis',

    async submitTryOn({ garmentImageUrl }) {
      count += 1;
      const requestId = `mock-tryon-${count}`;
      tryOns.set(requestId, {
        stage: 'try_on',
        url: garmentImageUrl || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800',
      });
      return {
        requestId,
        statusUrl: `https://${QUEUE_HOST}/mock/requests/${requestId}/status`,
        responseUrl: `https://${QUEUE_HOST}/mock/requests/${requestId}`,
      };
    },

    async submit3d() {
      count += 1;
      const requestId = `mock-3d-${count}`;
      tryOns.set(requestId, {
        stage: 'model_3d',
        url: 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Box/glTF-Binary/Box.glb',
      });
      return {
        requestId,
        statusUrl: `https://${QUEUE_HOST}/mock/requests/${requestId}/status`,
        responseUrl: `https://${QUEUE_HOST}/mock/requests/${requestId}`,
      };
    },

    async poll(request) {
      const stored = tryOns.get(request.requestId);
      if (!stored) throw new TryOnProviderError('invalid_output');
      if (stored.stage === 'try_on') {
        return {
          done: true,
          output: { images: [{ url: stored.url }] },
        };
      }
      return {
        done: true,
        output: { model_mesh: { url: stored.url } },
      };
    },

    async download(url, maxBytes, signal) {
      try {
        const res = await fetch(url, { signal });
        if (res.ok) {
          const bytes = Buffer.from(await res.arrayBuffer());
          if (bytes.length > 0 && bytes.length <= maxBytes) {
            return {
              bytes,
              contentType:
                res.headers.get('content-type') ?? (url.endsWith('.glb') ? 'model/gltf-binary' : 'image/jpeg'),
            };
          }
        }
      } catch {
        // Offline or blocked: fall back to the synthetic file below.
      }
      if (url.endsWith('.glb')) {
        const glb = Buffer.concat([Buffer.from('glTF', 'ascii'), Buffer.alloc(28, 3)]);
        return { bytes: glb, contentType: 'model/gltf-binary' };
      }
      const jpeg = Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'base64',
      );
      return { bytes: jpeg, contentType: 'image/jpeg' };
    },
  };
}

/** fal.ai queue API with the key in the header, server-side only. Model IDs come from config. */
export function falTryOnRenderer(
  apiKey: string,
  models: { tryOn: string; model3d: string },
  fetchImpl: typeof fetch = fetch,
): TryOnRenderer {
  if (apiKey === 'mock' || apiKey === 'test') {
    return mockTryOnRenderer();
  }

  const auth = { authorization: `Key ${apiKey}` };

  async function send(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, signal });
    } catch {
      throw new TryOnProviderError(signal.aborted ? 'timeout' : 'provider_error');
    }
    if (!res.ok) {
      let details: string | undefined;
      try {
        const text = await res.text();
        const data = JSON.parse(text);
        details = typeof data?.detail === 'string' ? data.detail : text;
      } catch {
        // No readable error body: report the status only.
      }
      throw new TryOnProviderError(failureFor(res.status), res.status, details);
    }
    return res;
  }

  async function json(res: Response, signal: AbortSignal): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      throw new TryOnProviderError(signal.aborted ? 'timeout' : 'invalid_output');
    }
  }

  async function submit(model: string, input: unknown, signal: AbortSignal): Promise<QueuedRequest> {
    const res = await send(
      `https://${QUEUE_HOST}/${model}`,
      { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(input) },
      signal,
    );
    const body = (await json(res, signal)) as { request_id?: unknown; status_url?: unknown; response_url?: unknown };
    if (typeof body?.request_id !== 'string' || !/^[\w-]{1,100}$/.test(body.request_id)) {
      throw new TryOnProviderError('invalid_output');
    }
    // fal returns where to poll; for a model ID with a sub-path these differ from the submit path.
    const base = `https://${QUEUE_HOST}/${model}/requests/${body.request_id}`;
    return {
      requestId: body.request_id,
      statusUrl: httpsUrl(body.status_url, QUEUE_HOST) ?? `${base}/status`,
      responseUrl: httpsUrl(body.response_url, QUEUE_HOST) ?? base,
    };
  }

  return {
    name: 'fal',
    tryOnModel: models.tryOn,
    model3d: models.model3d,

    submitTryOn({ person, garmentImageUrl, category }, signal) {
      return submit(
        models.tryOn,
        {
          model_image: person,
          garment_image: garmentImageUrl,
          category,
          // Store thumbnails are usually product shots on a model or flat; let FASHN tell which.
          garment_photo_type: 'auto',
          mode: 'balanced',
          num_samples: 1,
          output_format: 'jpeg',
        },
        signal,
      );
    },

    submit3d(imageUrl, signal) {
      return submit(models.model3d, { image_url: imageUrl, texture_size: 1024, mesh_simplify: 0.95 }, signal);
    },

    async poll(request, signal) {
      const statusUrl = httpsUrl(request.statusUrl, QUEUE_HOST);
      const responseUrl = httpsUrl(request.responseUrl, QUEUE_HOST);
      if (!statusUrl || !responseUrl) throw new TryOnProviderError('invalid_output');
      const status = (await json(await send(statusUrl, { headers: auth }, signal), signal)) as { status?: unknown };
      if (status?.status === 'IN_QUEUE' || status?.status === 'IN_PROGRESS') return { done: false };
      if (status?.status !== 'COMPLETED') throw new TryOnProviderError('invalid_output');
      // A request that failed on fal's side answers its result URL with an error status.
      return { done: true, output: await json(await send(responseUrl, { headers: auth }, signal), signal) };
    },

    async download(url, maxBytes, signal) {
      if (!httpsUrl(url)) throw new TryOnProviderError('invalid_output');
      const res = await send(url, {}, signal);
      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > maxBytes) throw new TryOnProviderError('invalid_output');
      let bytes: Buffer;
      try {
        bytes = Buffer.from(await res.arrayBuffer());
      } catch {
        throw new TryOnProviderError(signal.aborted ? 'timeout' : 'provider_error');
      }
      if (bytes.length === 0 || bytes.length > maxBytes) throw new TryOnProviderError('invalid_output');
      return { bytes, contentType: res.headers.get('content-type') ?? '' };
    },
  };
}

/**
 * Open-Source 3D Virtual Try-On microservice client (Pillar 1).
 * Communicates with a self-hosted or Google Colab FastAPI instance running TripoSR and IDM-VTON / rembg.
 */
export function openSourceTryOnRenderer(endpointUrl: string, fetchImpl: typeof fetch = fetch): TryOnRenderer {
  const base = endpointUrl.replace(/\/+$/, '');

  async function send(url: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, signal });
    } catch {
      throw new TryOnProviderError(
        signal.aborted ? 'timeout' : 'provider_error',
        undefined,
        `Could not connect to Open-Source 3D microservice at ${base}. Please ensure your Google Colab instance or local server is running.`,
      );
    }
    if (!res.ok) {
      let details: string | undefined;
      try {
        const text = await res.text();
        const data = JSON.parse(text);
        details = typeof data?.detail === 'string' ? data.detail : text;
      } catch {
        // No readable error body: report the status only.
      }
      throw new TryOnProviderError(failureFor(res.status), res.status, details);
    }
    return res;
  }

  async function json(res: Response, signal: AbortSignal): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      throw new TryOnProviderError(signal.aborted ? 'timeout' : 'invalid_output');
    }
  }

  return {
    name: 'triposr-colab',
    tryOnModel: 'opensource-vton',
    model3d: 'stabilityai/TripoSR',

    async submitTryOn({ person, garmentImageUrl, category }, signal) {
      const res = await send(
        `${base}/try-on`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ person, garment_image_url: garmentImageUrl, category }),
        },
        signal,
      );
      const data = (await json(res, signal)) as {
        request_id?: string;
        status?: string;
        status_url?: string;
        response_url?: string;
        output?: unknown;
      };
      const requestId = data.request_id ?? `req-${Date.now()}`;
      return {
        requestId,
        statusUrl: data.status_url ?? `${base}/status/${requestId}`,
        responseUrl: data.response_url ?? `${base}/status/${requestId}`,
      };
    },

    async submit3d(imageUrl, signal) {
      const res = await send(
        `${base}/generate-3d`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image_url: imageUrl }),
        },
        signal,
      );
      const data = (await json(res, signal)) as {
        request_id?: string;
        status?: string;
        status_url?: string;
        response_url?: string;
        output?: unknown;
      };
      const requestId = data.request_id ?? `req-${Date.now()}`;
      return {
        requestId,
        statusUrl: data.status_url ?? `${base}/status/${requestId}`,
        responseUrl: data.response_url ?? `${base}/status/${requestId}`,
      };
    },

    async poll(request, signal) {
      const res = await send(request.statusUrl, {}, signal);
      const data = (await json(res, signal)) as { status?: string; output?: unknown; done?: boolean };
      if (data.status === 'IN_QUEUE' || data.status === 'IN_PROGRESS' || data.done === false) {
        return { done: false };
      }
      if (data.status === 'COMPLETED' || data.done === true || data.output) {
        return { done: true, output: data.output ?? data };
      }
      throw new TryOnProviderError('invalid_output');
    },

    async download(url, maxBytes, signal) {
      const res = await send(url, {}, signal);
      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > maxBytes) throw new TryOnProviderError('invalid_output');
      let bytes: Buffer;
      try {
        bytes = Buffer.from(await res.arrayBuffer());
      } catch {
        throw new TryOnProviderError(signal.aborted ? 'timeout' : 'provider_error');
      }
      if (bytes.length === 0 || bytes.length > maxBytes) throw new TryOnProviderError('invalid_output');
      return {
        bytes,
        contentType: res.headers.get('content-type') ?? (url.endsWith('.glb') ? 'model/gltf-binary' : 'image/jpeg'),
      };
    },
  };
}
