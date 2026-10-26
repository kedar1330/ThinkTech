import { describe, expect, it, vi } from 'vitest';
import {
  cloudflareImageEditor,
  compositeImageEditor,
  pollinationsImageEditor,
} from '../../src/integrations/image/image-edit-client';

describe('image-edit-client', () => {
  it('cloudflareImageEditor returns base64 image on 200', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { image: Buffer.from('fake-image').toString('base64') } }),
    });

    const editor = cloudflareImageEditor('acc123', 'token123', '@cf/black-forest-labs/flux-1-schnell', fakeFetch as any);
    const res = await editor.edit({ prompt: 'test prompt', images: ['http://example.com/img.jpg'] }, new AbortController().signal);

    expect(res.bytes.toString()).toBe('fake-image');
    expect(res.contentType).toBe('image/jpeg');
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/black-forest-labs/flux-1-schnell',
      expect.objectContaining({
        method: 'POST',
        headers: { authorization: 'Bearer token123', 'content-type': 'application/json' },
      }),
    );
  });

  it('compositeImageEditor falls back to second editor if first fails', async () => {
    const editor1 = {
      name: 'failing',
      models: ['m1'],
      edit: vi.fn().mockRejectedValue(new Error('fail')),
    };
    const editor2 = {
      name: 'success',
      models: ['m2'],
      edit: vi.fn().mockResolvedValue({ bytes: Buffer.from('ok'), contentType: 'image/jpeg', model: 'm2' }),
    };

    const composite = compositeImageEditor([editor1, editor2]);
    const res = await composite.edit({ prompt: 'test', images: [] }, new AbortController().signal);
    expect(res.bytes.toString()).toBe('ok');
    expect(editor1.edit).toHaveBeenCalled();
    expect(editor2.edit).toHaveBeenCalled();
  });
});
