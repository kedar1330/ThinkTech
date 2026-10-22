import type { ClothingPreference } from '@styleme/contracts';
import {
  VisionProviderError,
  type PhotoAnalysisProvider,
  type PhotoInput,
  type VisionFailure,
} from '../../src/integrations/ai/vision-client';

// A fake photo-analysis provider (D-129; no real provider or key in tests). It records what it receives,
// so tests can check that only the photo leaves the API, and replies as told.

export type FakeVisionReply = { kind: 'reply'; body: unknown } | { kind: 'fail'; cause: VisionFailure };

export class FakeVisionProvider implements PhotoAnalysisProvider {
  readonly name = 'fake';
  readonly model = 'fake-vision-model';
  readonly calls: {
    kind: 'face' | 'body';
    photo: PhotoInput;
    department: ClothingPreference | null;
    heightCm: number | null;
  }[] = [];
  face: FakeVisionReply = { kind: 'reply', body: { usable: true, monkTone: 6, undertone: 'warm', confidence: 'high' } };
  body: FakeVisionReply = { kind: 'reply', body: { usable: true, bodyType: 'pear', confidence: 'medium' } };

  async analyzeFace(photo: PhotoInput): Promise<unknown> {
    this.calls.push({ kind: 'face', photo, department: null, heightCm: null });
    return this.answer(this.face);
  }

  async analyzeBody(photo: PhotoInput, department: ClothingPreference, heightCm: number | null): Promise<unknown> {
    this.calls.push({ kind: 'body', photo, department, heightCm });
    return this.answer(this.body);
  }

  private answer(reply: FakeVisionReply): unknown {
    if (reply.kind === 'fail') throw new VisionProviderError(reply.cause);
    return reply.body;
  }
}

/** A tiny synthetic JPEG (signature bytes only, no real image content). */
export const SYNTHETIC_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
/** A tiny synthetic PNG signature. */
export const SYNTHETIC_PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 2),
]);
