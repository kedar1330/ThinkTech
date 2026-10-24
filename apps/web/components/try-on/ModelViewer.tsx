'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

// `<model-viewer>` (Google, WebGL) is a custom element; React passes these as attributes.
type ModelViewerAttributes = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  src: string;
  alt: string;
  'camera-controls'?: string;
  'auto-rotate'?: string;
  'auto-rotate-delay'?: string;
  'rotation-per-second'?: string;
  'interaction-prompt'?: string;
  'touch-action'?: string;
  'shadow-intensity'?: string;
  'shadow-softness'?: string;
  exposure?: string;
  'environment-image'?: string;
  'camera-orbit'?: string;
  'min-camera-orbit'?: string;
  'max-camera-orbit'?: string;
  'interpolation-decay'?: string;
};

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- JSX typing for a custom element
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes;
    }
  }
}

/**
 * The 360° view of a try-on's 3D model (D-137): drag (or swipe) to turn it, pinch or scroll to zoom, with a
 * slow turntable until the user touches it, studio lighting and a soft floor shadow. The viewer script is
 * loaded only in the browser, when this mounts; `<model-viewer>` releases its WebGL context on unmount.
 */
export function ModelViewer({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    import('@google/model-viewer').catch(() => {
      if (!cancelled) setState('error');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onLoad = () => setState('ready');
    const onError = () => setState('error');
    el.addEventListener('load', onLoad);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('load', onLoad);
      el.removeEventListener('error', onError);
    };
  }, [src]);

  if (state === 'error') {
    return (
      <p role="status" className="rounded-xl bg-surface-muted p-4 text-sm text-muted-foreground">
        The 3D view couldn’t be shown on this device. Your try-on picture is still available.
      </p>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gradient-to-b from-surface-muted to-surface">
      <model-viewer
        ref={ref}
        src={src}
        alt={alt}
        camera-controls=""
        auto-rotate=""
        auto-rotate-delay="1500"
        rotation-per-second="20deg"
        interaction-prompt="auto"
        // Vertical swipes still scroll the page on phones; horizontal ones turn the model.
        touch-action="pan-y"
        shadow-intensity="1"
        shadow-softness="0.8"
        exposure="1"
        environment-image="neutral"
        camera-orbit="0deg 80deg auto"
        min-camera-orbit="auto 20deg auto"
        max-camera-orbit="auto 110deg auto"
        interpolation-decay="120"
        className="block size-full"
        style={{ width: '100%', height: '100%' }}
      />
      {state === 'loading' && (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Spinner /> Loading the 3D model…
        </p>
      )}
    </div>
  );
}
