import {
  TryOnProviderError,
  type DownloadedFile,
  type GarmentCategory,
  type QueueResult,
  type QueuedRequest,
  type TryOnFailure,
  type TryOnRenderer,
} from '../../src/integrations/tryon/fal-client';
import { SYNTHETIC_JPEG } from './vision';

// A fake fal.ai try-on renderer (D-137; no real provider or key in tests). It records what it receives, so
// tests can check what leaves the API, and replies as told: each queued request answers "running" for
// `pendingPolls` polls, then finishes. All content is synthetic.

/** A tiny synthetic GLB (the `glTF` magic and a header, no real model). */
export const SYNTHETIC_GLB = Buffer.concat([Buffer.from('glTF', 'ascii'), Buffer.alloc(28, 3)]);

export interface SubmittedTryOn {
  person: string;
  garmentImageUrl: string;
  category: GarmentCategory;
}

export class FakeTryOnRenderer implements TryOnRenderer {
  readonly name = 'fake';
  readonly tryOnModel = 'fake-try-on';
  readonly model3d = 'fake-3d';
  readonly tryOns: SubmittedTryOn[] = [];
  readonly models: string[] = [];
  readonly downloads: string[] = [];
  /** Polls that answer "running" before a request finishes. */
  pendingPolls = 1;
  /** Fail the next submit of this kind, or the result of a request of this kind. */
  failSubmit: { kind: 'try_on' | '3d'; cause: TryOnFailure } | null = null;
  failResult: { kind: 'try_on' | '3d'; cause: TryOnFailure } | null = null;
  pictureBytes: Buffer = SYNTHETIC_JPEG;
  modelBytes: Buffer = SYNTHETIC_GLB;
  private readonly polls = new Map<string, number>();
  private next = 0;

  async submitTryOn(input: SubmittedTryOn): Promise<QueuedRequest> {
    if (this.failSubmit?.kind === 'try_on') throw new TryOnProviderError(this.failSubmit.cause);
    this.tryOns.push(input);
    return this.queue(`tryon-${this.tryOns.length}`);
  }

  async submit3d(imageUrl: string): Promise<QueuedRequest> {
    if (this.failSubmit?.kind === '3d') throw new TryOnProviderError(this.failSubmit.cause);
    this.models.push(imageUrl);
    return this.queue(`model-${this.models.length}`);
  }

  async poll(request: QueuedRequest): Promise<QueueResult> {
    const seen = (this.polls.get(request.requestId) ?? 0) + 1;
    this.polls.set(request.requestId, seen);
    if (seen <= this.pendingPolls) return { done: false };
    const kind = request.requestId.startsWith('tryon') ? 'try_on' : '3d';
    if (this.failResult?.kind === kind) throw new TryOnProviderError(this.failResult.cause);
    return kind === 'try_on'
      ? { done: true, output: { images: [{ url: `https://cdn.example.test/${request.requestId}.jpg` }] } }
      : { done: true, output: { model_mesh: { url: `https://cdn.example.test/${request.requestId}.glb` } } };
  }

  async download(url: string): Promise<DownloadedFile> {
    this.downloads.push(url);
    return url.endsWith('.glb')
      ? { bytes: this.modelBytes, contentType: 'model/gltf-binary' }
      : { bytes: this.pictureBytes, contentType: 'image/jpeg' };
  }

  private queue(id: string): QueuedRequest {
    this.next += 1;
    const requestId = `${id}-${this.next}`;
    return {
      requestId,
      statusUrl: `https://queue.fal.run/fake/requests/${requestId}/status`,
      responseUrl: `https://queue.fal.run/fake/requests/${requestId}`,
    };
  }
}
