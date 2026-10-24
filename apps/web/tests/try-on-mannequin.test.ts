import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { LookSlot, ProductListing } from '@styleme/contracts';
import { buildFigure, disposeFigure } from '@/lib/try-on/figure';
import { dominantColour, layered, proportionsFor, shapeFor, takeOff, wear, type WornItem } from '@/lib/try-on/garments';

// The 3D mannequin's outfit rules and figure (D-137). three.js builds geometry without WebGL, so the figure is
// checked here; the browser only draws it. Listings are synthetic.

const spec = (
  category: LookSlot['lookSpec']['category'],
  extra: Partial<LookSlot['lookSpec']> = {},
): Pick<LookSlot, 'slot' | 'lookSpec'> => ({
  slot: 'top',
  lookSpec: { category, colorFamily: 'blue', colorId: 'navy', ...extra },
});

const listing = (title: string, price = 499): ProductListing => ({
  store: 'amazon',
  title,
  price,
  link: null,
  imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:synthetic',
});

const item = (slotId: string, slot: LookSlot['slot'], category: LookSlot['lookSpec']['category']): WornItem => ({
  slotId,
  slot,
  listing: listing(`Synthetic ${category}`),
  shape: shapeFor({ slot, lookSpec: { category, colorFamily: 'blue', colorId: 'navy' } }),
  colour: '#1f2a44',
});

describe('garment shapes', () => {
  it('draws each category as its own garment, following the look’s cut', () => {
    expect(shapeFor(spec('t_shirt'))).toMatchObject({ kind: 'top', sleeve: 'short', hem: 'hip' });
    expect(shapeFor(spec('kurta'))).toMatchObject({ kind: 'top', sleeve: 'full', hem: 'knee' });
    expect(shapeFor(spec('kurta', { sleeve: 'sleeveless', length: 'ankle' }))).toMatchObject({
      sleeve: 'none',
      hem: 'ankle',
    });
    expect(shapeFor({ ...spec('jeans'), slot: 'bottom' })).toMatchObject({ kind: 'trousers', hem: 'ankle' });
    expect(shapeFor({ ...spec('trousers', { silhouette: 'wide_leg' }), slot: 'bottom' })).toMatchObject({
      kind: 'trousers',
      width: 0.8,
    });
    expect(shapeFor({ ...spec('saree'), slot: 'one_piece' }).kind).toBe('saree');
    expect(shapeFor({ ...spec('lehenga'), slot: 'one_piece' }).kind).toBe('lehenga');
    expect(shapeFor({ ...spec('dress', { silhouette: 'a_line' }), slot: 'one_piece' })).toMatchObject({
      kind: 'dress',
      flare: 0.5,
    });
  });

  it('puts an item on in place of the one for the same part; a one-piece replaces top and bottom', () => {
    const top = item('top', 'top', 'shirt');
    const bottom = item('bottom', 'bottom', 'jeans');
    let outfit = wear(wear([], top), bottom);
    expect(outfit.map((w) => w.slotId)).toEqual(['top', 'bottom']);

    const otherTop = { ...item('top', 'top', 't_shirt'), listing: listing('Another top') };
    outfit = wear(outfit, otherTop);
    expect(outfit.map((w) => w.listing.title)).toEqual(['Synthetic jeans', 'Another top']);

    outfit = wear(outfit, item('dress', 'one_piece', 'dress'));
    expect(outfit.map((w) => w.slotId)).toEqual(['dress']);
    outfit = wear(outfit, top);
    expect(outfit.map((w) => w.slotId)).toEqual(['top']);
    expect(takeOff(outfit, 'top')).toEqual([]);
  });

  it('layers from the body out: one-piece and bottom, then top, then layer', () => {
    const outfit = [item('layer', 'layer', 'shirt'), item('top', 'top', 't_shirt'), item('bottom', 'bottom', 'jeans')];
    expect(layered(outfit).map((w) => w.slot)).toEqual(['bottom', 'top', 'layer']);
  });

  it('shapes the mannequin by body type', () => {
    expect(proportionsFor('pear').hips).toBeGreaterThan(proportionsFor('pear').shoulders);
    expect(proportionsFor('inverted_triangle').shoulders).toBeGreaterThan(1);
    expect(proportionsFor(null)).toEqual({ shoulders: 1, bust: 1, waist: 1, hips: 1 });
  });
});

describe('dominant colour of a product picture', () => {
  it('finds the garment’s colour and ignores the white backdrop', () => {
    const size = 10;
    const rgba = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      // A navy garment in the middle columns, white backdrop around it.
      const garment = x >= 3 && x <= 6;
      rgba.set(garment ? [31, 42, 68, 255] : [250, 250, 250, 255], i * 4);
    }
    expect(dominantColour(rgba, size, size)).toBe('#1f2a44');
  });

  it('is null for an empty or all-backdrop picture', () => {
    expect(dominantColour(new Uint8ClampedArray(16 * 4).fill(255), 4, 4)).toBeNull();
  });
});

describe('3D figure', () => {
  const names = (group: THREE.Object3D) => {
    const found: string[] = [];
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) found.push(o.name);
    });
    return found;
  };

  it('builds a mannequin with head, torso, arms and legs, and no garments when undressed', () => {
    const figure = buildFigure(THREE, { department: 'women', proportions: proportionsFor(null), outfit: [] });
    const meshes = names(figure);
    for (const part of ['body:head', 'body:torso', 'body:upper-arm', 'body:thigh', 'body:shoe']) {
      expect(meshes).toContain(part);
    }
    expect(meshes.some((n) => n.startsWith('garment:'))).toBe(false);
    disposeFigure(figure);
  });

  it('dresses it in each worn item’s colour, with sleeves on the arms', () => {
    const outfit = [item('top', 'top', 'shirt'), { ...item('bottom', 'bottom', 'jeans'), colour: '#d9c3a0' }];
    const figure = buildFigure(THREE, { department: 'men', proportions: proportionsFor('rectangle'), outfit });
    const garments: THREE.Mesh[] = [];
    figure.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name.startsWith('garment:')) garments.push(o as THREE.Mesh);
    });
    const colourOf = (slotId: string) =>
      `#${(garments.find((g) => g.name === `garment:${slotId}`)!.material as THREE.MeshStandardMaterial).color.getHexString()}`;
    expect(colourOf('top')).toBe('#1f2a44');
    expect(colourOf('bottom')).toBe('#d9c3a0');
    // Full sleeves on both arms (a sleeve and its cap each).
    expect(garments.filter((g) => g.name === 'garment:top' && g.parent !== figure).length).toBe(4);
    // Every garment geometry is valid (no NaN from the outline).
    for (const g of garments) {
      g.geometry.computeBoundingBox();
      expect(Number.isFinite(g.geometry.boundingBox!.max.y)).toBe(true);
    }
    disposeFigure(figure);
  });

  it('builds every garment kind without errors', () => {
    const kinds = [
      item('top', 'top', 'kurta'),
      item('one', 'one_piece', 'saree'),
      item('one2', 'one_piece', 'lehenga'),
      item('one3', 'one_piece', 'dress'),
      item('bottom', 'bottom', 'trousers'),
    ];
    for (const k of kinds) {
      const figure = buildFigure(THREE, { department: 'women', proportions: proportionsFor('pear'), outfit: [k] });
      expect(names(figure)).toContain(`garment:${k.slotId}`);
      disposeFigure(figure);
    }
  });
});
