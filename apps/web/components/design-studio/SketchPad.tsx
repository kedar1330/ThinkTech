'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Eraser, Pencil, Trash2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Drawing canvas for the Design Studio (D-134). Works with a mouse, finger or stylus (pointer events).
// The drawing is exported as a white-background JPEG, the same as an uploaded sketch.

export interface SketchPadHandle {
  /** The drawing as a JPEG, or null when nothing has been drawn. */
  exportImage(): Promise<File | null>;
}

const WIDTH = 768;
const HEIGHT = 1024;
const COLOURS = [
  { value: '#1f1b2e', name: 'Ink' },
  { value: '#7a2e5c', name: 'Plum' },
  { value: '#c8a45c', name: 'Gold' },
  { value: '#b23a3a', name: 'Red' },
  { value: '#2f6f6a', name: 'Teal' },
  { value: '#2d4f9e', name: 'Blue' },
];
const SIZES = [
  { value: 3, name: 'Fine' },
  { value: 6, name: 'Medium' },
  { value: 14, name: 'Thick' },
];
const UNDO_STEPS = 20;

export function SketchPad({ ref, onChange }: { ref?: Ref<SketchPadHandle>; onChange?: (hasDrawing: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<ImageData[]>([]);
  const [colour, setColour] = useState(COLOURS[0]!.value);
  const [size, setSize] = useState(SIZES[1]!.value);
  const [erasing, setErasing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  const context = () => canvasRef.current?.getContext('2d') ?? null;

  const clear = useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }, []);

  useEffect(clear, [clear]);

  const changed = (value: boolean) => {
    setHasDrawing(value);
    onChange?.(value);
  };

  useImperativeHandle(ref, () => ({
    async exportImage() {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawing) return null;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      return blob ? new File([blob], 'sketch.jpg', { type: 'image/jpeg' }) : null;
    },
  }));

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * WIDTH, y: ((e.clientY - rect.top) / rect.height) * HEIGHT };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = context();
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    history.current = [...history.current, ctx.getImageData(0, 0, WIDTH, HEIGHT)].slice(-UNDO_STEPS);
    setCanUndo(true);
    drawing.current = true;
    last.current = point(e);
    move(e);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = context();
    if (!ctx || !drawing.current || !last.current) return;
    const next = point(e);
    ctx.strokeStyle = erasing ? '#ffffff' : colour;
    ctx.lineWidth = erasing ? size * 3 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    last.current = next;
    if (!hasDrawing && !erasing) changed(true);
  };

  const end = () => {
    drawing.current = false;
    last.current = null;
  };

  const undo = () => {
    const ctx = context();
    const previous = history.current.pop();
    if (!ctx || !previous) return;
    ctx.putImageData(previous, 0, 0);
    setCanUndo(history.current.length > 0);
    if (history.current.length === 0) changed(false);
  };

  const reset = () => {
    history.current = [];
    setCanUndo(false);
    clear();
    changed(false);
  };

  const tool = 'inline-flex size-9 items-center justify-center rounded-full border transition';

  return (
    <div className="space-y-3">
      <div role="toolbar" aria-label="Drawing tools" className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={!erasing}
          aria-label="Pen"
          onClick={() => setErasing(false)}
          className={cn(tool, !erasing ? 'border-accent bg-accent/20' : 'border-border')}
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          aria-pressed={erasing}
          aria-label="Eraser"
          onClick={() => setErasing(true)}
          className={cn(tool, erasing ? 'border-accent bg-accent/20' : 'border-border')}
        >
          <Eraser className="size-4" />
        </button>
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        {COLOURS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={`${c.name} pen`}
            aria-pressed={!erasing && colour === c.value}
            onClick={() => {
              setColour(c.value);
              setErasing(false);
            }}
            className={cn(
              'size-7 rounded-full border-2',
              !erasing && colour === c.value ? 'border-accent ring-2 ring-accent/40' : 'border-surface',
            )}
            style={{ backgroundColor: c.value }}
          />
        ))}
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        {SIZES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-label={`${s.name} line`}
            aria-pressed={size === s.value}
            onClick={() => setSize(s.value)}
            className={cn(tool, size === s.value ? 'border-accent bg-accent/20' : 'border-border')}
          >
            <span
              className="rounded-full bg-foreground"
              style={{ width: s.value / 1.5 + 2, height: s.value / 1.5 + 2 }}
            />
          </button>
        ))}
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            className={cn(tool, 'border-border disabled:opacity-40')}
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!hasDrawing && !canUndo}
            aria-label="Clear drawing"
            className={cn(tool, 'border-border disabled:opacity-40')}
          >
            <Trash2 className="size-4" />
          </button>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        aria-label="Drawing area: sketch your outfit here"
        role="img"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        className="mx-auto block aspect-[3/4] w-full max-w-md touch-none cursor-crosshair rounded-xl border border-border bg-white shadow-inner"
      />
      <p className="text-center text-xs text-muted-foreground">
        Draw the outline: neckline, sleeves, length and any details. Rough is fine; add words below for the rest.
      </p>
    </div>
  );
}
