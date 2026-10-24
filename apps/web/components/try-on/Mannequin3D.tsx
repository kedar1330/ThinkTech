'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import type { Proportions, WornItem } from '@/lib/try-on/garments';
import type { Department } from '@/lib/try-on/figure';
import { Spinner } from '@/components/ui/spinner';

/** One quarter turn per click of the turn buttons. */
const TURN = Math.PI / 4;

interface Scene {
  setFigure(spec: { department: Department; proportions: Proportions; outfit: readonly WornItem[] }): void;
  turn(by: number): void;
  setAutoRotate(on: boolean): void;
  dispose(): void;
}

/**
 * The 3D mannequin (D-137), drawn with three.js in the browser: drag or swipe to turn it through 360°, pinch or
 * scroll to zoom, the turn buttons rotate it a quarter at a time, and it turns slowly by itself until touched.
 * Studio lighting with a soft floor shadow. three.js loads only when this mounts, and the WebGL context is
 * released when it unmounts.
 */
export function Mannequin3D({
  department,
  proportions,
  outfit,
  label,
}: {
  department: Department;
  proportions: Proportions;
  outfit: readonly WornItem[];
  /** Describes what is shown, for screen readers. */
  label: string;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>('loading');
  const [spinning, setSpinning] = useState(true);
  // The figure to draw once three.js has loaded; kept current by the effect below.
  const latest = useRef({ department, proportions, outfit });

  useEffect(() => {
    let cancelled = false;
    let created: Scene | null = null;
    (async () => {
      try {
        const [THREE, { OrbitControls }, { buildFigure, disposeFigure }] = await Promise.all([
          import('three'),
          import('three/addons/controls/OrbitControls.js'),
          import('@/lib/try-on/figure'),
        ]);
        const host = mount.current;
        if (cancelled || !host) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.domElement.style.touchAction = 'pan-y';
        host.appendChild(renderer.domElement);

        const world = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
        camera.position.set(0, 1.05, 4.4);

        // Studio light: a soft sky/ground fill, a key light that casts the floor shadow, and a rim light.
        world.add(new THREE.HemisphereLight('#ffffff', '#d8d0c4', 1.6));
        const key = new THREE.DirectionalLight('#ffffff', 2.2);
        key.position.set(1.8, 3.2, 2.4);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -1.2;
        key.shadow.camera.right = 1.2;
        key.shadow.camera.top = 2.2;
        key.shadow.camera.bottom = -0.2;
        key.shadow.radius = 6;
        world.add(key);
        const rim = new THREE.DirectionalLight('#fff4e8', 0.9);
        rim.position.set(-2, 2.5, -2.5);
        world.add(rim);
        const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        world.add(floor);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0.92, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.minDistance = 2.2;
        controls.maxDistance = 6;
        controls.minPolarAngle = Math.PI * 0.18;
        controls.maxPolarAngle = Math.PI * 0.56;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.2;
        // Turning by hand stops the slow spin, so the user keeps the view they chose.
        controls.addEventListener('start', () => {
          controls.autoRotate = false;
          setSpinning(false);
        });

        let figure: InstanceType<typeof THREE.Group> | null = null;
        let heading = 0;
        let target = 0;

        const resize = () => {
          const { clientWidth: w, clientHeight: h } = host;
          if (w === 0 || h === 0) return;
          renderer.setSize(w, h, false);
          renderer.domElement.style.width = '100%';
          renderer.domElement.style.height = '100%';
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        resize();

        let frame = 0;
        const loop = () => {
          frame = requestAnimationFrame(loop);
          // Ease the figure towards the heading the turn buttons asked for.
          heading += (target - heading) * 0.12;
          if (figure) figure.rotation.y = heading;
          controls.update();
          renderer.render(world, camera);
        };
        loop();

        created = {
          setFigure(spec) {
            if (figure) {
              world.remove(figure);
              disposeFigure(figure);
            }
            figure = buildFigure(THREE, spec);
            figure.rotation.y = heading;
            world.add(figure);
          },
          turn(by) {
            target += by;
          },
          setAutoRotate(on) {
            controls.autoRotate = on;
          },
          dispose() {
            cancelAnimationFrame(frame);
            observer.disconnect();
            controls.dispose();
            if (figure) disposeFigure(figure);
            floor.geometry.dispose();
            floor.material.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
          },
        };
        scene.current = created;
        created.setFigure(latest.current);
        setState('ready');
      } catch {
        // No WebGL (an old device or a disabled GPU), or three.js failed to load.
        if (!cancelled) setState('unsupported');
      }
    })();
    return () => {
      cancelled = true;
      created?.dispose();
      scene.current = null;
    };
  }, []);

  // Re-dress the figure whenever the outfit, body or department changes.
  useEffect(() => {
    latest.current = { department, proportions, outfit };
    scene.current?.setFigure(latest.current);
  }, [department, proportions, outfit]);

  if (state === 'unsupported') {
    return (
      <p role="status" className="rounded-xl bg-surface-muted p-4 text-sm text-muted-foreground">
        The 3D mannequin can’t be shown on this device. Your outfit is listed beside it.
      </p>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mount}
        role="img"
        aria-label={label}
        className="aspect-3/4 w-full overflow-hidden rounded-xl bg-linear-to-b from-surface to-surface-muted"
      />
      {state === 'loading' && (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Spinner /> Loading the 3D mannequin…
        </p>
      )}
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="Turn left"
          onClick={() => scene.current?.turn(-TURN)}
          className="rounded-full border border-border bg-surface/90 p-2 shadow-sm hover:border-plum/60"
        >
          <RotateCcw aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-pressed={spinning}
          aria-label={spinning ? 'Stop turning' : 'Turn slowly'}
          onClick={() => {
            scene.current?.setAutoRotate(!spinning);
            setSpinning(!spinning);
          }}
          className="rounded-full border border-border bg-surface/90 p-2 shadow-sm hover:border-plum/60"
        >
          {spinning ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Turn right"
          onClick={() => scene.current?.turn(TURN)}
          className="rounded-full border border-border bg-surface/90 p-2 shadow-sm hover:border-plum/60"
        >
          <RotateCw aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
