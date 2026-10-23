import type { DesignImageProvider } from '@styleme/contracts';
import type { DesignAnalysisProvider, DesignImageInput } from '../../src/integrations/ai/design-client';
import { VisionProviderError, type VisionFailure } from '../../src/integrations/ai/vision-client';
import {
  ImageProviderError,
  type GeneratedImage,
  type ImageGenerator,
} from '../../src/integrations/image/image-client';
import { SYNTHETIC_JPEG, SYNTHETIC_PNG } from './vision';

// Fake Design Studio providers (D-134; no real provider or key in tests). They record what they receive,
// so tests can check what leaves the API, and reply as told. All content is synthetic.

export const SYNTHETIC_DESIGN_REPLY = {
  usable: true,
  title: 'Fixture puff-sleeve kurta',
  summary: 'A synthetic straight kurta with puff sleeves. Used only in tests.',
  imagePrompt: 'A straight cotton kurta in teal with elbow-length puff sleeves and a round neckline',
  tailorSpec: {
    garment: 'Straight kurta',
    silhouette: 'Straight, slightly flared at the hem',
    neckline: 'Round neckline with a 4-inch front placket',
    sleeves: 'Elbow-length puff sleeves gathered into a 1-inch band',
    length: 'Knee length',
    closure: 'Hidden button placket at the front',
    fabric: { primary: 'Cotton cambric', alternatives: ['Linen blend'], lining: 'Cotton voile' },
    yardage: {
      estimate: '2.5–3 m of 44-inch fabric',
      basis: 'Standard size M; confirm with the wearer’s measurements',
    },
    cutting: ['Cut front and back on the straight grain'],
    stitching: ['Gather the sleeve head before setting it in'],
    finishing: ['Narrow hem'],
    embellishment: [],
    tailorNotes: ['Synthetic fixture note'],
  },
};

export type FakeDesignReply = { kind: 'reply'; body: unknown } | { kind: 'fail'; cause: VisionFailure };

export class FakeDesignAnalysis implements DesignAnalysisProvider {
  readonly name = 'fake';
  readonly model = 'fake-design-model';
  readonly calls: { brief: string; image: DesignImageInput | null }[] = [];
  reply: FakeDesignReply = { kind: 'reply', body: SYNTHETIC_DESIGN_REPLY };

  async deconstruct(input: { brief: string; image: DesignImageInput | null }): Promise<unknown> {
    this.calls.push(input);
    if (this.reply.kind === 'fail') throw new VisionProviderError(this.reply.cause);
    return this.reply.body;
  }
}

export class FakeImageGenerator implements ImageGenerator {
  readonly model = 'fake-flux';
  readonly prompts: string[] = [];
  /** `fail` throws a provider error; `garbage` returns bytes that are not an image. */
  mode: 'ok' | 'fail' | 'garbage' = 'ok';

  constructor(
    readonly name: DesignImageProvider,
    private readonly image: Buffer = name === 'pollinations' ? SYNTHETIC_JPEG : SYNTHETIC_PNG,
  ) {}

  async generate(prompt: string): Promise<GeneratedImage> {
    this.prompts.push(prompt);
    if (this.mode === 'fail') throw new ImageProviderError('rate_limited', 429);
    if (this.mode === 'garbage') return { bytes: Buffer.from('not an image'), contentType: 'image/jpeg' };
    return { bytes: this.image, contentType: 'image/jpeg' };
  }
}
