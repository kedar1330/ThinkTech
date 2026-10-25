import type * as Three from 'three';
import type { RoomEnvironment as RoomEnvironmentClass } from 'three/addons/environments/RoomEnvironment.js';

// The studio the 3D mannequin stands in (D-137): soft reflections from three.js's built-in room environment,
// a key light that casts a soft floor shadow, a fill and a rim light, and a low round plinth. All from code, no
// files. `THREE` and the room are passed in, so three.js still loads only in the browser.

type ThreeModule = typeof Three;

export interface Stage {
  /** Where the camera looks and where it starts. */
  target: Three.Vector3;
  cameraPosition: Three.Vector3;
  dispose(): void;
}

export function buildStage(
  THREE: ThreeModule,
  RoomEnvironment: typeof RoomEnvironmentClass,
  world: Three.Scene,
  renderer: Three.WebGLRenderer,
): Stage {
  // Soft, even reflections, so the mannequin's finish and the fabrics' sheen read as materials.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  world.environment = environment;
  world.environmentIntensity = 0.55;

  world.add(new THREE.HemisphereLight('#ffffff', '#e4dccf', 0.7));
  const key = new THREE.DirectionalLight('#fff8f0', 2.1);
  key.position.set(1.4, 3.4, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  // Bias stops the shadow speckling ("acne") on curved surfaces.
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  Object.assign(key.shadow.camera, { left: -1, right: 1, top: 2.1, bottom: -0.2, near: 0.5, far: 8 });
  world.add(key);
  const fill = new THREE.DirectionalLight('#f3f6ff', 0.6);
  fill.position.set(-2.4, 1.6, 1.8);
  world.add(fill);
  const rim = new THREE.DirectionalLight('#fff1e2', 1.1);
  rim.position.set(-1.2, 2.8, -2.8);
  world.add(rim);

  // A low plinth, its top at the floor (y = 0), with the figure's shadow on it.
  const plinthMaterial = new THREE.MeshPhysicalMaterial({ color: '#eee6da', roughness: 0.55, clearcoat: 0.2 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.05, 72), plinthMaterial);
  plinth.position.y = -0.025;
  plinth.receiveShadow = true;
  world.add(plinth);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 72), new THREE.ShadowMaterial({ opacity: 0.12 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.05;
  floor.receiveShadow = true;
  world.add(floor);

  return {
    target: new THREE.Vector3(0, 0.86, 0),
    cameraPosition: new THREE.Vector3(0, 0.98, 3.95),
    dispose() {
      pmrem.dispose();
      environment.dispose();
      room.traverse((o) => {
        const m = o as Three.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      plinth.geometry.dispose();
      plinthMaterial.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
    },
  };
}
