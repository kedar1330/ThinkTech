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
// (like the code-generated figures of D-113). Units are metres, y up, feet at 0, facing +z. The body is made of
// smooth lathed outlines (torso, legs, arms) shaped a little further (bust, seat); every garment is a slightly
// larger shell around the body part it covers, in the item's colour, with soft folds where it hangs free and
// a finished hem. `THREE` is passed in, so the page loads three.js only in the browser and tests can build the
// figure without WebGL.

type ThreeModule = typeof Three;

export type Department = 'women' | 'men';

/** Body landmarks (y) and radii; the torso is an ellipse, `DEPTH` times as deep as it is wide. */
const DEPTH = 0.68;
const Y = { crotch: 0.8, hip: 0.9, waist: 1.04, bust: 1.2, chest: 1.31, shoulder: 1.4, neck: 1.48 };

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

/** The leg, from the hip joint (0) down to the ankle; the arm, from the shoulder (0) down to the wrist. */
const LEG_LENGTH = 0.79;
const ARM_TILT = 0.17;

interface Body {
  department: Department;
  shoulders: number;
  bust: number;
  waist: number;
  hips: number;
  armLength: number;
}

function bodyFor(department: Department, p: Proportions): Body {
  const base =
    department === 'men'
      ? { shoulders: 0.205, bust: 0.168, waist: 0.15, hips: 0.163, armLength: 0.6 }
      : { shoulders: 0.182, bust: 0.162, waist: 0.128, hips: 0.176, armLength: 0.57 };
  return {
    department,
    shoulders: base.shoulders * p.shoulders,
    bust: base.bust * p.bust,
    waist: base.waist * p.waist,
    hips: base.hips * p.hips,
    armLength: base.armLength,
  };
}

type Outline = Array<[number, number]>;

/** The torso's outline (radius, y) from the crotch to the neck, before smoothing. */
function torsoOutline(b: Body): Outline {
  return [
    [0.012, Y.crotch - 0.025],
    [b.hips * 0.84, Y.crotch + 0.01],
    [b.hips, Y.hip],
    [(b.hips + b.waist) / 2 + 0.006, (Y.hip + Y.waist) / 2],
    [b.waist, Y.waist],
    [(b.waist + b.bust) / 2 + 0.008, (Y.waist + Y.bust) / 2],
    [b.bust, Y.bust],
    [(b.bust + b.shoulders) / 2, Y.chest],
    [b.shoulders * 0.9, Y.shoulder - 0.02],
    [b.shoulders * 0.62, Y.shoulder + 0.035],
    [0.062, Y.neck - 0.01],
    [0.056, Y.neck + 0.05],
  ];
}

/** The leg's outline (radius, y below the hip joint). */
function legOutline(b: Body): Outline {
  return [
    [0.03, -LEG_LENGTH],
    [0.036, -0.7],
    [0.052, -0.56],
    [0.045, -0.44],
    [0.05, -0.38],
    [b.hips * 0.4, -0.16],
    [b.hips * 0.47, -0.02],
    [b.hips * 0.42, 0.04],
  ];
}

/** The arm's outline (radius, y below the shoulder), closed over the top. */
function armOutline(b: Body): Outline {
  const l = b.armLength;
  return [
    [0.025, -l],
    [0.033, -0.8 * l],
    [0.036, -0.6 * l],
    [0.034, -0.5 * l],
    [0.042, -0.32 * l],
    [0.047, -0.12 * l],
    [0.044, 0.01],
    [0.03, 0.035],
    [0.001, 0.045],
  ];
}

export interface FigureSpec {
  department: Department;
  proportions: Proportions;
  outfit: readonly WornItem[];
}

/** The mannequin with its outfit, as one group to add to a scene. Named meshes make it testable. */
export function buildFigure(THREE: ThreeModule, spec: FigureSpec): Three.Group {
  const b = bodyFor(spec.department, spec.proportions);
  const women = b.department === 'women';
  const figure = new THREE.Group();
  figure.name = 'figure';

  // A satin mannequin finish, light shoes, and fabric with a soft sheen.
  const skin = new THREE.MeshPhysicalMaterial({
    color: '#ece5da',
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.45,
  });
  const shoe = new THREE.MeshPhysicalMaterial({ color: '#d9cfc2', roughness: 0.5, clearcoat: 0.4 });
  const fabric = (colour: string) =>
    new THREE.MeshPhysicalMaterial({
      color: colour,
      roughness: 0.86,
      metalness: 0,
      sheen: 0.6,
      sheenRoughness: 0.65,
      sheenColor: new THREE.Color(colour).lerp(new THREE.Color('#ffffff'), 0.35),
      side: THREE.DoubleSide,
    });
  /** A slightly darker shade of a garment's colour, for its trims, placket and buttons. */
  const trim = (colour: string) =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colour).multiplyScalar(0.82),
      roughness: 0.7,
      sheen: 0.4,
      side: THREE.DoubleSide,
    });

  const mesh = (geometry: Three.BufferGeometry, material: Three.Material, name: string) => {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  /** A smooth outline through the given points, `samples` long, never below zero radius. */
  const smooth = (outline: Outline, samples = 64): Outline =>
    new THREE.SplineCurve(outline.map(([r, y]) => new THREE.Vector2(r, y)))
      .getPoints(samples)
      .map((p) => [Math.max(p.x, 0.0005), p.y]);
  const lathe = (outline: Outline, scale = 1, segments = 72) =>
    new THREE.LatheGeometry(
      outline.map(([r, y]) => new THREE.Vector2(r * scale, y)),
      segments,
    );
  /** The radius of an outline at height y. */
  const radiusAt = (outline: Outline, y: number): number => {
    for (let i = 1; i < outline.length; i++) {
      const [r0, y0] = outline[i - 1]!;
      const [r1, y1] = outline[i]!;
      if (y >= Math.min(y0, y1) && y <= Math.max(y0, y1)) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1);
    }
    return y < outline[0]![1] ? outline[0]![0] : outline[outline.length - 1]![0];
  };
  /**
   * Reshapes a lathed geometry: `factor(y, angle)` scales each point's distance from the axis, where the angle
   * is 0 at the front (+z) and ±π at the back.
   */
  const sculpt = (geometry: Three.BufferGeometry, factor: (y: number, angle: number) => number) => {
    const position = geometry.attributes.position as Three.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const angle = Math.atan2(x, z);
      const f = factor(y, angle);
      position.setXYZ(i, x * f, y, z * f);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  };
  const bump = (d: number, width: number) => Math.exp(-((d / width) ** 2));
  /** The body's own shaping (bust in front, seat behind), so garments follow it too. */
  const bodyShape = (y: number, angle: number) => {
    const front = Math.max(0, Math.cos(angle)) ** 2;
    const back = Math.max(0, -Math.cos(angle)) ** 2;
    // The bust as two soft rounds either side of the middle.
    const sides = women ? Math.max(bump(angle - 0.55, 0.42), bump(angle + 0.55, 0.42)) : 1;
    const bust = (women ? 0.16 : 0.05) * bump(y - Y.bust, 0.075) * front * sides;
    const seat = (women ? 0.11 : 0.07) * bump(y - (Y.hip - 0.015), 0.07) * back;
    const blades = 0.03 * bump(y - Y.chest, 0.08) * back;
    return 1 + bust + seat + blades;
  };

  // --- Mannequin -------------------------------------------------------------------------------------
  const torsoOut = smooth(torsoOutline(b), 96);
  const torso = mesh(sculpt(lathe(torsoOut), bodyShape), skin, 'body:torso');
  torso.scale.z = DEPTH;
  figure.add(torso);
  // A featureless head (FR-AVT-03): an egg, slightly forward, on the neck.
  const head = mesh(new THREE.SphereGeometry(0.1, 48, 32), skin, 'body:head');
  head.scale.set(0.86, 1.13, 0.98);
  head.position.set(0, Y.neck + 0.16, 0.012);
  figure.add(head);

  // Legs, hips to ankles, slightly apart, each with a shoe.
  const hipX = b.hips * 0.46;
  const legOut = smooth(legOutline(b));
  const legs: Three.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * hipX, Y.crotch + 0.04, 0);
    leg.rotation.z = side * 0.02;
    const limb = mesh(lathe(legOut, 1, 48), skin, 'body:leg');
    limb.scale.z = 0.92;
    leg.add(limb);
    // A closed shoe with a rounded toe and a low heel.
    const foot = mesh(new THREE.CapsuleGeometry(0.036, 0.13, 8, 24), shoe, 'body:shoe');
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(1, 1, 0.62);
    foot.position.set(0, -LEG_LENGTH - 0.012, 0.045);
    leg.add(foot);
    legs.push(leg);
    figure.add(leg);
  }

  // Arms hang slightly away from the body (an A pose), so sleeves stay visible.
  const armOut = smooth(armOutline(b));
  const arms: Three.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * b.shoulders * 0.9, Y.shoulder - 0.035, 0);
    arm.rotation.z = side * ARM_TILT;
    arm.add(mesh(lathe(armOut, 1, 40), skin, 'body:arm'));
    const hand = mesh(new THREE.CapsuleGeometry(0.022, 0.07, 6, 16), skin, 'body:hand');
    hand.scale.set(1, 1, 0.55);
    hand.position.y = -b.armLength - 0.045;
    arm.add(hand);
    arm.userData.side = side;
    arms.push(arm);
    figure.add(arm);
  }

  // --- Garments ------------------------------------------------------------------------------------
  /** Soft vertical folds, deepening from `fromY` down to `hemY`; more and deeper the fuller the garment. */
  const folds =
    (fromY: number, hemY: number, flare: number, pleats = 0) =>
    (y: number, angle: number) => {
      const t = Math.min(1, Math.max(0, (fromY - y) / (fromY - hemY || 1)));
      // Two waves of folds, so they don't look machine-regular.
      const n = 7 + Math.round(flare * 7);
      const wave =
        (Math.sin(angle * n + 0.6) * 0.75 + Math.sin(angle * (n * 2 + 1) + 1.9) * 0.25) *
        (0.016 + flare * 0.045) *
        t ** 1.3;
      // Pleats gathered at the front (a saree's).
      const front = pleats * Math.max(0, Math.cos(angle)) ** 4 * Math.sin(angle * 40) * 0.03 * t;
      return 1 + wave + front;
    };

  /**
   * A finished edge: a thin ring of radius r at height y, oval like the body, shaped by the garment's own
   * `factor` so it follows the folds of the hem.
   */
  const hemTrim = (
    r: number,
    y: number,
    material: Three.Material,
    name: string,
    depth = DEPTH,
    factor: (y: number, angle: number) => number = () => 1,
  ) => {
    const geometry = new THREE.TorusGeometry(r, 0.0045, 8, 128);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, y, 0);
    const ring = mesh(
      sculpt(geometry, (_, angle) => factor(y, angle)),
      material,
      name,
    );
    ring.scale.z = depth;
    return ring;
  };

  const addSleeves = (
    sleeve: SleeveLength,
    material: Three.Material,
    edge: Three.Material,
    scale: number,
    name: string,
  ) => {
    const reach = SLEEVE_REACH[sleeve];
    if (reach === 0) return;
    const end = -b.armLength * reach;
    // Follows the arm, a little looser, opening slightly towards its end, and closes over the shoulder.
    const points: Outline = armOut
      .filter(([, y]) => y >= end)
      .map(([r, y]) => [y > 0 ? r * scale * 1.06 : Math.max(r, 0.031) * scale * 1.06 + 0.004 * (y / end), y]);
    points.unshift([Math.max(radiusAt(armOut, end), 0.031) * scale * 1.06 + 0.005, end]);
    for (const arm of arms) {
      arm.add(mesh(lathe(points, 1, 40), material, name));
      arm.add(hemTrim(points[0]![0], end, edge, name, 1));
    }
  };

  /** A garment's radius at y: the body's, or between the bust and the hips, towards a straight fall by `ease`. */
  const eased = (r: number, y: number, ease: number) => {
    if (y <= Y.hip || y >= Y.bust) return r;
    const line = b.hips + ((b.bust - b.hips) * (y - Y.hip)) / (Y.bust - Y.hip);
    return r + Math.max(0, line - r) * ease;
  };

  /**
   * A body shell from `fromY` (the shoulders: up to a round neckline) down to `hemY`. Between the bust and the
   * hips it hangs straight rather than following the waist, less so the more fitted it is (`ease`, 0 to 1).
   * Returns the geometry, the hem's radius and the shaping, so the hem's trim can follow it.
   */
  const bodice = (
    fromY: number,
    hemY: number,
    scale: number,
    flare: number,
    ease = 0,
    fold = true,
  ): [Three.BufferGeometry, number, (y: number, angle: number) => number] => {
    const straight = (r: number, y: number) => eased(r, y, ease);
    const points: Outline = [];
    let hemR: number;
    if (hemY < Y.hip) {
      // Below the hips the garment hangs free: from the hips straight down to the hem, flaring out.
      hemR = b.hips * (1.03 + flare * 0.45);
      points.push([hemR, hemY]);
      points.push([b.hips * (1.02 + flare * 0.15), (hemY + Y.hip) / 2]);
      for (const [r, y] of torsoOut) if (y >= Y.hip && y <= fromY) points.push([straight(r, y), y]);
    } else {
      hemR = straight(radiusAt(torsoOut, hemY), hemY);
      points.push([hemR, hemY]);
      for (const [r, y] of torsoOut) if (y > hemY && y <= fromY) points.push([straight(r, y), y]);
    }
    if (fromY >= Y.shoulder) {
      for (const [r, y] of torsoOut) if (y > fromY && y < Y.neck - 0.02) points.push([r, y]);
      points.push([0.078, Y.neck - 0.012]);
    } else points.push([radiusAt(torsoOut, fromY), fromY]);
    // Folds where it hangs free; none for a shell that only covers the body under another garment.
    const shape = (y: number, a: number) =>
      y < Y.hip ? bodyShape(Y.hip, a) * (fold ? folds(Y.hip, hemY, flare)(y, a) : 1) : bodyShape(y, a);
    return [sculpt(lathe(points, scale), shape), hemR * scale, shape];
  };

  const skirt = (
    hemY: number,
    scale: number,
    flare: number,
    pleats = 0,
  ): [Three.BufferGeometry, number, (y: number, angle: number) => number] => {
    const hemR = b.hips * (1.06 + flare * 1.3);
    const points: Outline = smooth(
      [
        [hemR, hemY],
        [b.hips * (1.04 + flare * 0.55), (hemY + Y.hip) / 2],
        [b.hips * 1.02, Y.hip],
        [radiusAt(torsoOut, Y.waist), Y.waist],
      ],
      40,
    );
    const shape = (y: number, a: number) =>
      y < Y.hip ? bodyShape(Y.hip, a) * folds(Y.hip, hemY, flare, pleats)(y, a) : bodyShape(y, a);
    return [sculpt(lathe(points, scale), shape), hemR * scale, shape];
  };

  /** A point on the front of the torso, just outside a shell of this scale and ease, at (x, y). */
  const onFront = (x: number, y: number, scale: number, ease = 0) => {
    const r = eased(radiusAt(torsoOut, y), y, ease) * scale * bodyShape(y, 0);
    return new THREE.Vector3(x, y, Math.sqrt(Math.max(r * r - x * x, 0)) * DEPTH + 0.004);
  };

  /** A flat band of cloth along a path, `width` wide, facing out from the body. */
  const ribbon = (path: Three.Curve<Three.Vector3>, width: number, samples: number, ripple: number) => {
    const positions: number[] = [];
    const indices: number[] = [];
    let previous: Three.Vector3 | null = null;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = path.getPointAt(t);
      const tangent = path.getTangentAt(t);
      // Out from the body; over the shoulders that turns upwards, so a band lies flat over a shoulder.
      const lift = Math.min(1, Math.max(0, (p.y - Y.chest) / (Y.shoulder - Y.chest)));
      const outward = new THREE.Vector3(p.x, lift * 0.3, p.z / DEPTH).normalize();
      const across = new THREE.Vector3().crossVectors(tangent, outward).normalize();
      // Keep the band's edges on the same sides all along, so it never twists over itself.
      if (previous && across.dot(previous) < 0) across.negate();
      previous = across;
      // A soft wave across the band, so it reads as cloth.
      const wave = Math.sin(t * Math.PI * 9) * ripple;
      for (const s of [-1, 1]) {
        const v = p
          .clone()
          .addScaledVector(across, (s * width) / 2)
          .addScaledVector(outward, wave * s);
        positions.push(v.x, v.y, v.z);
      }
      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  };

  /** A kurta's placket (and a shirt's front), with buttons, and a shirt's collar. */
  const frontDetail = (
    detail: 'placket' | 'collar',
    to: number,
    scale: number,
    ease: number,
    edge: Three.Material,
    name: string,
  ) => {
    const top = Y.neck - 0.03;
    const bottom = detail === 'placket' ? Y.bust - 0.02 : Math.max(to, Y.hip);
    // Follows the front of the garment, over the chest.
    const steps = 12;
    const path = new THREE.CatmullRomCurve3(
      Array.from({ length: steps + 1 }, (_, i) => onFront(0, top - ((top - bottom) * i) / steps, scale, ease)),
    );
    figure.add(mesh(ribbon(path, 0.022, 40, 0), edge, name));
    const count = detail === 'placket' ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const y = top - 0.03 - ((top - bottom - 0.05) * i) / Math.max(count - 1, 1);
      const button = mesh(new THREE.SphereGeometry(0.006, 12, 8), edge, name);
      button.position.copy(onFront(0, y, scale, ease)).add(new THREE.Vector3(0, 0, 0.004));
      figure.add(button);
    }
    // A collar, standing at the neck (a band for a kurta's placket, a turned collar for a shirt).
    const collar = mesh(
      new THREE.CylinderGeometry(0.07 * scale, 0.082 * scale, detail === 'collar' ? 0.045 : 0.03, 48, 1, true),
      edge,
      name,
    );
    collar.scale.z = 0.92;
    collar.position.y = Y.neck - 0.005;
    figure.add(collar);
  };

  /** A saree's pallu: a draped band from the right hip, across the chest, over the left shoulder and down the back. */
  const pallu = (scale: number, material: Three.Material, name: string) => {
    const out = (x: number, y: number, back: boolean) => {
      // The body's shaping where the band actually lies (over the bust, not the middle), found in two steps.
      let angle = back ? Math.PI : 0;
      let z = 0;
      for (let i = 0; i < 3; i++) {
        const r = radiusAt(torsoOut, y) * scale * 1.03 * bodyShape(y, angle);
        z = Math.sqrt(Math.max(r * r - x * x, 0)) + 0.008 / DEPTH;
        angle = Math.atan2(x, back ? -z : z);
      }
      return new THREE.Vector3(x, y, (back ? -z : z) * DEPTH);
    };
    const path = new THREE.CatmullRomCurve3([
      out(b.hips * 0.55, Y.hip, false),
      out(b.waist * 0.25, Y.waist + 0.04, false),
      out(-b.bust * 0.3, Y.bust + 0.02, false),
      out(-b.shoulders * 0.48, Y.chest + 0.05, false),
      new THREE.Vector3(-b.shoulders * 0.56, Y.shoulder + 0.025, 0),
      out(-b.shoulders * 0.52, Y.chest + 0.02, true),
      out(-b.shoulders * 0.45, Y.waist + 0.04, true),
      out(-b.hips * 0.4, Y.hip - 0.1, true),
    ]);
    figure.add(mesh(ribbon(path, 0.12, 90, 0.003), material, name));
  };

  const draw = (item: WornItem) => {
    const material = fabric(item.colour);
    const edge = trim(item.colour);
    const scale = OFFSET[item.slot] ?? 1.08;
    const name = `garment:${item.slotId}`;
    const shell = (
      [geometry, hemR, shaping]: [Three.BufferGeometry, number, (y: number, angle: number) => number],
      hemY: number,
    ) => {
      const m = mesh(geometry, material, name);
      m.scale.z = DEPTH;
      figure.add(m);
      figure.add(hemTrim(hemR, hemY, edge, name, DEPTH, shaping));
    };
    const shape: GarmentShape = item.shape;
    switch (shape.kind) {
      case 'top': {
        const hemY = HEM_Y[shape.hem];
        // Close-fitting tops follow the waist; others fall straight from the chest.
        const ease = Math.min(1, 0.55 + shape.flare * 1.5);
        shell(bodice(Y.shoulder, hemY, scale, shape.flare, ease), hemY);
        addSleeves(shape.sleeve, material, edge, scale, name);
        if (shape.detail) frontDetail(shape.detail, hemY, scale, ease, edge, name);
        break;
      }
      case 'dress':
        shell(bodice(Y.shoulder, Y.waist - 0.01, scale, 0), Y.waist - 0.01);
        shell(skirt(HEM_Y[shape.hem], scale, shape.flare), HEM_Y[shape.hem]);
        addSleeves(shape.sleeve, material, edge, scale, name);
        break;
      case 'lehenga':
        // A cropped blouse and a full, floor-length skirt.
        shell(bodice(Y.shoulder, HEM_Y.cropped, scale, 0), HEM_Y.cropped);
        shell(skirt(HEM_Y.floor, scale, 0.9), HEM_Y.floor);
        addSleeves(shape.sleeve, material, edge, scale, name);
        break;
      case 'saree':
        // A cropped blouse, a pleated skirt and the pallu over the left shoulder.
        shell(bodice(Y.shoulder, HEM_Y.cropped, scale, 0), HEM_Y.cropped);
        shell(skirt(HEM_Y.floor, scale, 0.32, 1), HEM_Y.floor);
        addSleeves(shape.sleeve, material, edge, scale, name);
        pallu(scale, material, name);
        break;
      case 'trousers': {
        // Waist to crotch along the body (so a top over it always covers it), then one leg on each leg,
        // following it down to the hem.
        const [seat] = bodice(Y.waist, Y.crotch - 0.01, scale, 0, 0, false);
        const waist = mesh(seat, material, name);
        waist.scale.z = DEPTH;
        figure.add(waist);
        const hemY = Math.max(HEM_Y[shape.hem], 0.09) - (Y.crotch + 0.04);
        const hemR = 0.05 + shape.width * 0.075;
        const points: Outline = legOut
          .filter(([, y]) => y > hemY && y <= 0.04)
          .map(([r, y]) => {
            const t = (y - 0.04) / (hemY - 0.04);
            return [Math.max(r * 1.12 + 0.006, r + (hemR - r) * t * t), y];
          });
        points.unshift([hemR, hemY]);
        for (const leg of legs) {
          const trouser = mesh(sculpt(lathe(points, 1, 48), folds(-0.45, hemY, shape.width * 0.5)), material, name);
          trouser.scale.z = 0.94;
          leg.add(trouser);
          leg.add(hemTrim(hemR, hemY, edge, name, 0.94));
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
