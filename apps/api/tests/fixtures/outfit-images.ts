import {
  ImageProviderError,
  type GeneratedImage,
  type ImageFailure,
  type ImageRequest,
  type OutfitImageProvider,
} from '../../src/integrations/ai/image-client';
import { SYNTHETIC_JPEG } from './vision';

// A fake outfit image provider (no real provider or key in tests). It records every prompt it receives, so
// tests can check that nothing about the user leaves the API, and replies as told.

export type FakeImageReply = { kind: 'image'; image: GeneratedImage } | { kind: 'fail'; cause: ImageFailure };

export class FakeImageProvider implements OutfitImageProvider {
  readonly name = 'fake';
  readonly model = 'fake-image-model';
  readonly calls: ImageRequest[] = [];
  reply: FakeImageReply = { kind: 'image', image: { bytes: SYNTHETIC_JPEG, contentType: 'image/jpeg' } };

  async generate(request: ImageRequest): Promise<GeneratedImage> {
    this.calls.push(request);
    if (this.reply.kind === 'fail') throw new ImageProviderError(this.reply.cause);
    return this.reply.image;
  }
}
