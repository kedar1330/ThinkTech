import type { EditedImage, ImageEditor } from '../../src/integrations/image/image-edit-client';
import { ImageProviderError, type ImageFailure } from '../../src/integrations/image/image-client';
import { SYNTHETIC_PNG } from './vision';

// A fake Pollinations image editor for the cartoon avatar drape (D-138; no real provider or key in tests). It
// records every edit, so tests can check what leaves the API, and replies as told. Pictures are synthetic: each
// reply is a PNG signature followed by the number of the edit, so tests can tell the results apart.

export class FakeImageEditor implements ImageEditor {
  readonly name = 'pollinations' as const;
  readonly models = ['fake-edit-model'];
  readonly edits: Array<{ prompt: string; images: readonly string[] }> = [];
  fail: ImageFailure | null = null;

  async edit(input: { prompt: string; images: readonly string[] }): Promise<EditedImage> {
    if (this.fail) throw new ImageProviderError(this.fail);
    this.edits.push(input);
    const bytes = Buffer.concat([SYNTHETIC_PNG, Buffer.from(`edit-${this.edits.length}`)]);
    return { bytes, contentType: '', model: 'fake-edit-model' };
  }
}
