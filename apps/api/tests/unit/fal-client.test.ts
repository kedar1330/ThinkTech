import { describe, expect, it } from 'vitest';
import {
  TryOnProviderError,
  falTryOnRenderer,
  openSourceTryOnRenderer,
  modelMeshUrl,
  tryOnImageUrl,
} from '../../src/integrations/tryon/fal-client';
import { SYNTHETIC_JPEG } from '../fixtures/vision';

// The fal.ai queue client for 3D Virtual Try-On (D-137). No network: a fake fetch answers in turn.

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

function fakeFetch(...replies: Reply[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const reply = replies.shift() ?? { status: 500 };
    const body = Buffer.isBuffer(reply.body) ? reply.body : JSON.stringify(reply.body ?? {});
    return new Response(body, { status: reply.status ?? 200, headers: reply.headers });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const MODELS = { tryOn: 'fal-ai/fashn/tryon/v1.6', model3d: 'fal-ai/trellis' };
const signal = () => new AbortController().signal;

describe('fal.ai try-on client', () => {
  it('queues a try-on with the key in the header and polls where fal says', async () => {
    const { impl, calls } = fakeFetch({
      body: {
        request_id: 'req-1',
        status_url: 'https://queue.fal.run/fal-ai/fashn/requests/req-1/status',
        response_url: 'https://queue.fal.run/fal-ai/fashn/requests/req-1',
      },
    });
    const renderer = falTryOnRenderer('secret-key', MODELS, impl);
    const queued = await renderer.submitTryOn(
      { person: 'data:image/jpeg;base64,AAAA', garmentImageUrl: 'https://x.gstatic.com/a', category: 'tops' },
      signal(),
    );
    expect(queued).toEqual({
      requestId: 'req-1',
      statusUrl: 'https://queue.fal.run/fal-ai/fashn/requests/req-1/status',
      responseUrl: 'https://queue.fal.run/fal-ai/fashn/requests/req-1',
    });
    expect(calls[0]!.url).toBe('https://queue.fal.run/fal-ai/fashn/tryon/v1.6');
    expect((calls[0]!.init!.headers as Record<string, string>).authorization).toBe('Key secret-key');
    expect(JSON.parse(String(calls[0]!.init!.body))).toMatchObject({
      model_image: 'data:image/jpeg;base64,AAAA',
      garment_image: 'https://x.gstatic.com/a',
      category: 'tops',
    });
  });

  it('builds the poll URLs itself when fal gives none, and refuses ones on another host', async () => {
    const { impl } = fakeFetch(
      { body: { request_id: 'r2' } },
      { body: { request_id: 'r3', status_url: 'https://evil.example/status', response_url: 'http://queue.fal.run/x' } },
    );
    const renderer = falTryOnRenderer('k', MODELS, impl);
    expect(await renderer.submit3d('https://cdn/x.jpg', signal())).toEqual({
      requestId: 'r2',
      statusUrl: 'https://queue.fal.run/fal-ai/trellis/requests/r2/status',
      responseUrl: 'https://queue.fal.run/fal-ai/trellis/requests/r2',
    });
    expect(await renderer.submit3d('https://cdn/x.jpg', signal())).toMatchObject({
      statusUrl: 'https://queue.fal.run/fal-ai/trellis/requests/r3/status',
      responseUrl: 'https://queue.fal.run/fal-ai/trellis/requests/r3',
    });
  });

  it('reports queued and running as not done, and returns the output once completed', async () => {
    const request = {
      requestId: 'r',
      statusUrl: 'https://queue.fal.run/m/requests/r/status',
      responseUrl: 'https://queue.fal.run/m/requests/r',
    };
    const { impl, calls } = fakeFetch(
      { body: { status: 'IN_QUEUE' } },
      { body: { status: 'IN_PROGRESS' } },
      { body: { status: 'COMPLETED' } },
      { body: { images: [{ url: 'https://cdn.fal.media/out.jpg' }] } },
      { body: { status: 'COMPLETED' } },
      { status: 422, body: { detail: 'bad garment' } },
    );
    const renderer = falTryOnRenderer('k', MODELS, impl);
    expect(await renderer.poll(request, signal())).toEqual({ done: false });
    expect(await renderer.poll(request, signal())).toEqual({ done: false });
    const done = await renderer.poll(request, signal());
    expect(done.done && tryOnImageUrl(done.output)).toBe('https://cdn.fal.media/out.jpg');
    expect(calls[3]!.url).toBe(request.responseUrl);
    await expect(renderer.poll(request, signal())).rejects.toMatchObject({ cause: 'provider_error', status: 422 });
  });

  it('maps rate limits and bad keys', async () => {
    const { impl } = fakeFetch({ status: 429 }, { status: 401 });
    const renderer = falTryOnRenderer('k', MODELS, impl);
    const input = { person: 'p', garmentImageUrl: 'https://g', category: 'tops' as const };
    await expect(renderer.submitTryOn(input, signal())).rejects.toMatchObject({ cause: 'rate_limited' });
    await expect(renderer.submitTryOn(input, signal())).rejects.toMatchObject({ cause: 'unauthorized' });
  });

  it('downloads results within the size limit only', async () => {
    const { impl } = fakeFetch(
      { body: SYNTHETIC_JPEG, headers: { 'content-type': 'image/jpeg' } },
      { body: Buffer.alloc(100, 1) },
    );
    const renderer = falTryOnRenderer('k', MODELS, impl);
    const file = await renderer.download('https://cdn.fal.media/a.jpg', 1024, signal());
    expect(file).toEqual({ bytes: SYNTHETIC_JPEG, contentType: 'image/jpeg' });
    await expect(renderer.download('https://cdn.fal.media/b.glb', 10, signal())).rejects.toBeInstanceOf(
      TryOnProviderError,
    );
    await expect(renderer.download('http://cdn.fal.media/c.glb', 10, signal())).rejects.toMatchObject({
      cause: 'invalid_output',
    });
  });

  it('reads the picture and model URLs from replies, refusing anything else', () => {
    expect(modelMeshUrl({ model_mesh: { url: 'https://cdn.fal.media/m.glb' } })).toBe('https://cdn.fal.media/m.glb');
    expect(modelMeshUrl({ model_glb: { url: 'https://cdn.fal.media/n.glb' } })).toBe('https://cdn.fal.media/n.glb');
    expect(() => modelMeshUrl({ model_mesh: { url: 'javascript:alert(1)' } })).toThrow(TryOnProviderError);
    expect(() => tryOnImageUrl({ images: [] })).toThrow(TryOnProviderError);
    expect(() => tryOnImageUrl(null)).toThrow(TryOnProviderError);
  });

  it('supports mockTryOnRenderer when apiKey is mock', async () => {
    const renderer = falTryOnRenderer('mock', MODELS);
    expect(renderer.name).toBe('mock');
    const queued = await renderer.submitTryOn(
      { person: 'data:image/jpeg;base64,AAAA', garmentImageUrl: 'https://cdn/garment.jpg', category: 'tops' },
      signal(),
    );
    expect(queued.requestId).toBeDefined();
    const pollResult = await renderer.poll(queued, signal());
    expect(pollResult.done).toBe(true);
    const m3d = await renderer.submit3d('https://cdn/garment.jpg', signal());
    const m3dPoll = await renderer.poll(m3d, signal());
    expect(m3dPoll.done).toBe(true);
  });

  it('supports openSourceTryOnRenderer with custom endpoint', async () => {
    const { impl } = fakeFetch(
      { body: { request_id: 'os-1', status_url: 'https://tunnel.example/status/os-1' } },
      { body: { status: 'COMPLETED', output: { images: [{ url: 'https://tunnel.example/dressed.jpg' }] } } },
      { body: { request_id: 'os-3d-1', status_url: 'https://tunnel.example/status/os-3d-1' } },
      { body: { status: 'COMPLETED', output: { model_mesh: { url: 'https://tunnel.example/model.glb' } } } },
    );
    const renderer = openSourceTryOnRenderer('https://tunnel.example', impl);
    expect(renderer.name).toBe('triposr-colab');
    const queued = await renderer.submitTryOn(
      { person: 'data:image/jpeg;base64,AAAA', garmentImageUrl: 'https://cdn/garment.jpg', category: 'tops' },
      signal(),
    );
    expect(queued.requestId).toBe('os-1');
    const poll = await renderer.poll(queued, signal());
    expect(poll.done).toBe(true);
    if (poll.done) {
      expect(tryOnImageUrl(poll.output)).toBe('https://tunnel.example/dressed.jpg');
    }

    const m3dQueued = await renderer.submit3d('https://tunnel.example/dressed.jpg', signal());
    const m3dPoll = await renderer.poll(m3dQueued, signal());
    expect(m3dPoll.done).toBe(true);
    if (m3dPoll.done) {
      expect(modelMeshUrl(m3dPoll.output)).toBe('https://tunnel.example/model.glb');
    }
  });
});
