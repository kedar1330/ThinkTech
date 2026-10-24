import type * as Three from 'three';
import {
  layered,
  type GarmentShape,
  type HemLength,
  type Proportions,
  type SleeveLength,
  type WornItem,
} from './garments';

// Builds the 3D mannequin and its garments from code (D-137): no model files, so no asset rights to record
// (like the code-generated figures of D-113). Units are metres, y up, feet at 0, facing +z. Every garment is
// a slightly larger shell around the body part it covers, in the item's colour. `THREE` is passed in, so the
// page loads three.js only in the browser and tests can build the figure without WebGL.

type ThreeModule = typeof Three;

export type Department = 'women' | 'men';

/** Body landmarks (y) and radii; the torso is an ellipse, `DEPTH` times as deep as it is wide. */
const DEPTH = 0.66;
const Y = { crotch: 0.8, hip: 0.9, waist: 1.04, bust: 1.2, chest: 1.32, shoulder: 1.4, neck: 1.47 };

const HEM_Y: Record<HemLength, number> = {
  cropped: 1.12,
  waist: 1.03,
  hip: 0.86,
  thigh: 0.68,
  knee: 0.5,
  midi: 0.3,
  ankle: 0.1,
  floor: 0.03,
};

/** How far down the arm a sleeve reaches: 0 is the shoulder, 1 the wrist. */
const SLEEVE_REACH: Record<SleeveLength, number> = {
  none: 0,
  cap: 0.12,
  short: 0.3,
  elbow: 0.5,
  three_quarter: 0.72,
  full: 1,
};

/** Shells sit outside the body, and outer layers outside inner ones. */
const OFFSET: Record<string, number> = { one_piece: 1.05, bottom: 1.04, top: 1.08, layer: 1.13 };

interface Body {
  shoulders: number;
  bust: number;
  waist: number;
  hips: number;
  armLength: number;
}

function bodyFor(department: Department, p: Proportions): Body {
  const base =
    department === 'men'
      ? { shoulders: 0.205, bust: 0.165, waist: 0.15, hips: 0.165, armLength: 0.6 }
      : { shoulders: 0.185, bust: 0.165, waist: 0.13, hips: 0.178, armLength: 0.57 };
  return {
    shoulders: base.shoulders * p.shoulders,
    bust: base.bust * p.bust,
    waist: base.waist * p.waist,
    hips: base.hips * p.hips,
    armLength: base.armLength,
  };
}

/** The torso's outline (radius, y) from the crotch to the neck. */
function torsoProfile(b: Body): Array<[number, number]> {
  return [
    [0.02, Y.crotch - 0.02],
    [b.hips * 0.8, Y.crotch],
    [b.hips, Y.hip],
    [(b.hips + b.waist) / 2, (Y.hip + Y.waist) / 2],
    [b.waist, Y.waist],
    [b.bust, Y.bust],
    [(b.bust + b.shoulders) / 2, Y.chest],
    [b.shoulders * 0.92, Y.shoulder],
    [0.065, Y.neck],
    [0.05, Y.neck + 0.03],
  ];
}

/** The torso's radius at height y, read from the outline. */
function radiusAt(profile: Array<[number, number]>, y: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1]!;
    const [r1, y1] = profile[i]!;
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1);
  }
  return y < profile[0]![1] ? profile[0]![0] : profile[profile.length - 1]![0];
}

export interface FigureSpec {
  department: Department;
  proportions: Proportions;
  outfit: readonly WornItem[];
}

/** The mannequin with its outfit, as one group to add to a scene. Named meshes make it testable. */
export function buildFigure(THREE: ThreeModule, spec: FigureSpec): Three.Group {
  const b = bodyFor(spec.department, spec.proportions);
  const figure = new THREE.Group();
  figure.name = 'figure';
  const skin = new THREE.MeshStandardMaterial({ color: '#e9e3da', roughness: 0.55, metalness: 0 });
  const shoe = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.7 });
  const fabric = (colour: string) =>
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });

  const mesh = (geometry: Three.BufferGeometry, material: Three.Material, name: string) => {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const lathe = (points: Array<[number, number]>, scale = 1) =>
    new THREE.LatheGeometry(
      points.map(([r, y]) => new THREE.Vector2(r * scale, y)),
      48,
    );
  /** A tube from (x, y0) down to (x, y1), radius r0 at the top and r1 at the bottom. */
  const tube = (r0: number, r1: number, y0: number, y1: number, open = false) => {
    const g = new THREE.CylinderGeometry(r0, r1, y0 - y1, 32, 1, open);
    g.translate(0, (y0 + y1) / 2, 0);
    return g;
  };

  // --- Mannequin -------------------------------------------------------------------------------------
  const profile = torsoProfile(b);
  const torso = mesh(lathe(profile), skin, 'body:torso');
  torso.scale.z = DEPTH;
  figure.add(torso);
  figure.add(mesh(tube(0.05, 0.055, Y.neck + 0.08, Y.neck - 0.02), skin, 'body:neck'));
  const head = mesh(new THREE.SphereGeometry(0.1, 32, 24), skin, 'body:head');
  head.scale.set(0.9, 1.15, 0.95);
  head.position.y = Y.neck + 0.17;
  figure.add(head);

  // Legs, hips to ankles, slightly apart.
  const hipX = b.hips * 0.48;
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * hipX, Y.crotch + 0.04, 0);
    leg.rotation.z = side * 0.025;
    leg.add(mesh(tube(b.hips * 0.44, 0.05, 0, -0.42), skin, 'body:thigh'));
    leg.add(mesh(tube(0.05, 0.036, -0.42, -0.79), skin, 'body:calf'));
    const foot = mesh(new THREE.BoxGeometry(0.08, 0.06, 0.22), shoe, 'body:shoe');
    foot.position.set(0, -0.8, 0.05);
    leg.add(foot);
    figure.add(leg);
  }

  // Arms hang slightly away from the body (an A pose), so sleeves stay visible.
  const arms: Three.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * b.shoulders * 0.95, Y.shoulder - 0.03, 0);
    arm.rotation.z = side * 0.2;
    const upper = b.armLength * 0.52;
    arm.add(mesh(tube(0.045, 0.038, 0, -upper), skin, 'body:upper-arm'));
    arm.add(mesh(tube(0.036, 0.028, -upper, -b.armLength), skin, 'body:forearm'));
    const hand = mesh(new THREE.SphereGeometry(0.035, 16, 12), skin, 'body:hand');
    hand.scale.set(0.8, 1.4, 0.6);
    hand.position.y = -b.armLength - 0.04;
    arm.add(hand);
    const shoulder = mesh(new THREE.SphereGeometry(0.05, 20, 16), skin, 'body:shoulder');
    arm.add(shoulder);
    arm.userData.side = side;
    arms.push(arm);
    figure.add(arm);
  }

  // --- Garments ------------------------------------------------------------------------------------
  const addSleeves = (sleeve: SleeveLength, material: Three.Material, scale: number, name: string) => {
    const reach = SLEEVE_REACH[sleeve];
    if (reach === 0) return;
    for (const arm of arms) {
      const end = b.armLength * reach;
      const sleeveMesh = mesh(tube(0.058 * scale, (0.058 - 0.02 * reach) * scale, 0.02, -end, true), material, name);
      arm.add(sleeveMesh);
      const cap = mesh(new THREE.SphereGeometry(0.06 * scale, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), material, name);
      cap.position.y = 0.01;
      arm.add(cap);
    }
  };

  /** A body shell from the shoulders (or `fromY`) down to `hemY`, flaring out below the hips. */
  const bodice = (fromY: number, hemY: number, scale: number, flare: number) => {
    const points: Array<[number, number]> = [];
    if (hemY < Y.crotch) {
      // Below the crotch the garment hangs free: a cone from the hips to the hem.
      const hemR = b.hips * (1.02 + flare * 0.7);
      points.push([hemR, hemY]);
      for (const [r, y] of profile) if (y >= Y.hip && y <= fromY) points.push([r, y]);
    } else {
      points.push([radiusAt(profile, hemY), hemY]);
      for (const [r, y] of profile) if (y > hemY && y <= fromY) points.push([r, y]);
    }
    if (fromY < Y.shoulder) points.push([radiusAt(profile, fromY), fromY]);
    else points.push([0.075, Y.neck - 0.01]);
    return lathe(points, scale);
  };

  const skirt = (hemY: number, scale: number, flare: number, fromY = Y.waist) => {
    const hemR = b.hips * (1.04 + flare * 1.3);
    return lathe(
      [
        [hemR, hemY],
        [Math.max(b.hips * 1.02, (hemR + b.hips) / 2), (hemY + Y.hip) / 2],
        [b.hips, Y.hip],
        [radiusAt(profile, fromY), fromY],
      ],
      scale,
    );
  };

  const draw = (item: WornItem) => {
    const material = fabric(item.colour);
    const scale = OFFSET[item.slot] ?? 1.08;
    const name = `garment:${item.slotId}`;
    const shell = (geometry: Three.BufferGeometry) => {
      const m = mesh(geometry, material, name);
      m.scale.z = DEPTH;
      figure.add(m);
    };
    const shape: GarmentShape = item.shape;
    switch (shape.kind) {
      case 'top':
        shell(bodice(Y.shoulder, HEM_Y[shape.hem], scale, shape.flare));
        addSleeves(shape.sleeve, material, scale, name);
        break;
      case 'dress':
        shell(bodice(Y.shoulder, Y.waist - 0.01, scale, 0));
        shell(skirt(HEM_Y[shape.hem], scale, shape.flare));
        addSleeves(shape.sleeve, material, scale, name);
        break;
      case 'lehenga':
        // A cropped blouse and a full, floor-length skirt.
        shell(bodice(Y.shoulder, HEM_Y.cropped, scale, 0));
        shell(skirt(HEM_Y.floor, scale, 0.9));
        addSleeves(shape.sleeve, material, scale, name);
        break;
      case 'saree': {
        shell(bodice(Y.shoulder, HEM_Y.cropped, scale, 0));
        shell(skirt(HEM_Y.floor, scale, 0.35));
        addSleeves(shape.sleeve, material, scale, name);
        // The pallu: a band from the waist across the chest and over the left shoulder.
        const pallu = mesh(new THREE.BoxGeometry(0.13, 0.62, 0.012), material, name);
        pallu.position.set(-0.02, (Y.waist + Y.shoulder) / 2 + 0.02, b.bust * DEPTH * scale + 0.012);
        pallu.rotation.z = -0.55;
        figure.add(pallu);
        break;
      }
      case 'trousers': {
        // Waistband to crotch, then one tube per leg, following the leg's slight angle.
        shell(bodice(Y.waist, Y.crotch - 0.01, scale, 0));
        const hemY = HEM_Y[shape.hem];
        const hemR = 0.052 + shape.width * 0.07;
        for (const side of [-1, 1]) {
          const leg = mesh(
            tube(b.hips * 0.5 * scale, hemR, Y.crotch + 0.04, Math.max(hemY, 0.09), true),
            material,
            name,
          );
          leg.position.x = side * hipX;
          leg.rotation.z = side * 0.025;
          figure.add(leg);
        }
        break;
      }
    }
  };

  for (const item of layered(spec.outfit)) draw(item);
  return figure;
}

/** Frees the GPU memory of everything in the group (geometries and materials). */
export function disposeFigure(group: Three.Object3D): void {
  group.traverse((object) => {
    const m = object as Three.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const materials = Array.isArray(m.material) ? m.material : [m.material];
    for (const material of materials) material.dispose();
  });
}
