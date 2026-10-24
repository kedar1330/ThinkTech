import { dominantColour } from './garments';

// Reads an item's main colour from its store thumbnail in the browser (D-137), through our same-origin
// thumbnail route so the canvas may read it. Results are remembered for the page's lifetime.

const cache = new Map<string, Promise<string | null>>();

export function itemColour(imageUrl: string): Promise<string | null> {
  let pending = cache.get(imageUrl);
  if (!pending) {
    pending = read(imageUrl);
    cache.set(imageUrl, pending);
  }
  return pending;
}

function read(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        resolve(dominantColour(ctx.getImageData(0, 0, size, size).data, size, size));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = `/api/try-on/thumbnail?url=${encodeURIComponent(imageUrl)}`;
  });
}
