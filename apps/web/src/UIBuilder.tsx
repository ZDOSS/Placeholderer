import { useState, useRef, useEffect, useCallback } from 'react';
import {
  type Layer,
  type RectLayer,
  type CircleLayer,
  type LineLayer,
  type TextLayer,
  type RasterLayer,
  type FilledShapeLayer,
  type BlendMode,
} from '@placeholderer/schemas';
import { validateBuilderRecipe } from '@placeholderer/core';
import { colors } from './colors';
import { renderLayer, exportSVG, preloadRasterImages, rasterCache, type SupportedExportFormat } from './builderRender';
import { encodeBmp, encodeGif } from '@placeholderer/core';
import { PRESETS } from './builderPresets';

const STORAGE_KEY = 'placeholderer:builder';
const HISTORY_LIMIT = 5;
const DEFAULT_GRID = 16;

const BLEND_MODES: BlendMode[] = [
  'source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
];

interface BuilderState {
  layers: Layer[];
  width: number;
  height: number;
  gridSize: number;
  snapEnabled: boolean;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultState(): BuilderState {
  return {
    layers: [
      rectLayer({ name: 'Background', x: 0, y: 0, width: 800, height: 600, fill: '#2D3748', locked: true }),
    ],
    width: 800,
    height: 600,
    gridSize: DEFAULT_GRID,
    snapEnabled: true,
  };
}

function rectLayer(opts: Partial<RectLayer> & { name: string; x: number; y: number; width: number; height: number; fill?: string }): RectLayer {
  return {
    id: makeId(),
    type: 'rect',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    fill: opts.fill ?? '#4A5568',
    ...opts,
  };
}

function circleLayer(opts: Partial<CircleLayer> & { name: string; x: number; y: number; width: number; height: number; fill?: string }): CircleLayer {
  return {
    id: makeId(),
    type: 'circle',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    fill: opts.fill ?? '#4A5568',
    ...opts,
  };
}

function lineLayer(opts: Partial<LineLayer> & { name: string; x: number; y: number; width: number; height: number }): LineLayer {
  return {
    id: makeId(),
    type: 'line',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    stroke: { color: '#718096', width: 2 },
    ...opts,
  };
}

function textLayer(opts: Partial<TextLayer> & { name: string; x: number; y: number; width: number; height: number; content: string }): TextLayer {
  return {
    id: makeId(),
    type: 'text',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    fill: '#ffffff',
    text: { content: opts.content, fontSize: 24, fontFamily: 'system-ui, sans-serif', align: 'left' },
    ...opts,
  };
}

function rasterLayer(opts: { name: string; x: number; y: number; width: number; height: number; rasterSrc: string }): RasterLayer {
  return {
    id: makeId(),
    type: 'raster',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    ...opts,
  };
}

function filledShapeLayer(opts: Partial<FilledShapeLayer> & { name: string; x: number; y: number; width: number; height: number; fill?: string }): FilledShapeLayer {
  return {
    id: makeId(),
    type: 'filled-shape',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    fill: opts.fill ?? '#4A5568',
    ...opts,
  };
}

function loadFromStorage(): BuilderState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BuilderState;
  } catch {
    return null;
  }
}

function saveToStorage(state: BuilderState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function UIBuilder() {
  const [state, setState] = useState<BuilderState>(() => loadFromStorage() ?? defaultState());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<BuilderState[]>([]);
  const [future, setFuture] = useState<BuilderState[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [editingRecipe, setEditingRecipe] = useState(false);
  // Presets are hidden behind a button by design — clicking a
  // preset appends its layers and resizes the canvas, which can
  // trample in-progress work. Users opt in by clicking the
  // Presets button next to Clear.
  const [presetsOpen, setPresetsOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInteracting = useRef<{ mode: 'move' | 'resize' | null; resizeHandle?: string; offsetX: number; offsetY: number; startW: number; startH: number; preState: BuilderState | null }>({ mode: null, offsetX: 0, offsetY: 0, startW: 0, startH: 0, preState: null });

  // Persist on every state change
  useEffect(() => { saveToStorage(state); }, [state]);

  // Close the presets popover when clicking anywhere outside it
  // (including the trigger button — otherwise mousedown on the
  // button closes it before the click handler reopens it).
  // Cheap global listener; only does work while the popover is open.
  useEffect(() => {
    if (!presetsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('[data-presets-popover]') || target.closest('[data-presets-trigger]'))) return;
      setPresetsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [presetsOpen]);

  // Tick that increments each time an image fill (or raster layer)
  // finishes loading. The render effect below depends on this so the
  // canvas re-draws when the new image becomes available instead of
  // waiting for the next user interaction.
  const [preloadTick, setPreloadTick] = useState(0);

  // Preload every image source referenced by the layer stack so the
  // live preview shows the actual image (not just the fallback fill)
  // the moment the user picks one. The export path also awaits this
  // helper; the on-screen render only needs the cache to be warm.
  useEffect(() => {
    let cancelled = false;
    const sources = new Set<string>();
    for (const layer of state.layers) {
      if (layer.type === 'raster' && layer.rasterSrc) sources.add(layer.rasterSrc);
      const fill: any = (layer as any).fill;
      if (fill && typeof fill === 'object' && fill.type === 'image' && fill.src) {
        sources.add(fill.src);
      }
    }
    for (const src of sources) {
      // Skip sources that already finished loading. The cache is the
      // only signal drawImageFillOverlay and drawRaster trust, so we
      // don't put an Image in it until onload has actually fired —
      // that way an in-flight load stays invisible (and drawImage
      // doesn't get handed a half-loaded image).
      const existing = rasterCache.get(src);
      if (existing && existing.complete && existing.naturalWidth > 0) continue;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        rasterCache.set(src, img);
        setPreloadTick((t) => t + 1);
      };
      img.onerror = () => {
        if (cancelled) return;
        // Don't cache failures. The render effect will keep using
        // the fallback fill.
        setPreloadTick((t) => t + 1);
      };
      img.src = src;
    }
    return () => { cancelled = true; };
  }, [state.layers]);

  // Snap helper
  const snap = useCallback((v: number): number => {
    if (!state.snapEnabled) return v;
    return Math.round(v / state.gridSize) * state.gridSize;
  }, [state.snapEnabled, state.gridSize]);

  // Push to history before mutating
  const pushHistory = useCallback((next: BuilderState) => {
    setHistory((h) => {
      const trimmed = h.length >= HISTORY_LIMIT ? h.slice(1) : h;
      return [...trimmed, state];
    });
    setFuture([]);
    setState(next);
  }, [state]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [state, ...f]);
    setState(prev);
  }, [history, state]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, state]);
    setState(next);
  }, [future, state]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        deleteLayer(selectedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = state.width;
    canvas.height = state.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    if (state.gridSize > 0) {
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      for (let x = 0; x <= canvas.width; x += state.gridSize) {
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, canvas.height); ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += state.gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(canvas.width, y + 0.5); ctx.stroke();
      }
    }

    state.layers.forEach((layer) => {
      renderLayer({ ctx, width: state.width, height: state.height }, layer);
    });

    // Selection outline
    if (selectedId) {
      const sel = state.layers.find((l) => l.id === selectedId);
      if (sel) {
        const x = sel.x ?? 0;
        const y = sel.y ?? 0;
        const w = sel.width ?? 0;
        const h = sel.height ?? 0;
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
      }
    }
  }, [state, selectedId, colors, preloadTick]);

  const addLayer = (factory: () => Layer) => {
    const layer = factory();
    pushHistory({ ...state, layers: [...state.layers, layer] });
    setSelectedId(layer.id);
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    pushHistory({
      ...state,
      layers: state.layers.map((l) => (l.id === id ? ({ ...l, ...updates } as Layer) : l)),
    });
  };

  const deleteLayer = (id: string) => {
    pushHistory({ ...state, layers: state.layers.filter((l) => l.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateLayer = (id: string) => {
    const layer = state.layers.find((l) => l.id === id);
    if (!layer) return;
    const clone: Layer = { ...layer, id: makeId(), name: layer.name + ' copy', x: (layer.x ?? 0) + 16, y: (layer.y ?? 0) + 16 };
    pushHistory({ ...state, layers: [...state.layers, clone] });
    setSelectedId(clone.id);
  };

  const moveLayer = (id: string, direction: 'up' | 'down') => {
    const idx = state.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx + 1 : idx - 1;
    if (swapWith < 0 || swapWith >= state.layers.length) return;
    const layers = [...state.layers];
    [layers[idx], layers[swapWith]] = [layers[swapWith], layers[idx]];
    pushHistory({ ...state, layers });
  };

  const startFromScratch = () => {
    pushHistory(defaultState());
    setSelectedId(null);
  };

  const importRaster = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        addLayer(() => rasterLayer({
          name: file.name,
          x: 120, y: 120, width: 200, height: 150,
          rasterSrc: ev.target?.result as string,
        }));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const exportImage = async (format: SupportedExportFormat) => {
    if (format === 'svg') {
      const svg = exportSVG(state.layers, state.width, state.height);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      download(blob, 'ui-placeholder.svg');
      return;
    }
    // Wait for any imported raster images to finish loading before
    // capturing the export. Without this, an imported image is
    // silently absent from the resulting PNG/JPG/BMP/GIF because
    // drawRaster kicks off an async image load and the toBlob call
    // races it.
    await preloadRasterImages(state.layers);
    // PNG / JPEG / BMP / GIF: render to an off-screen canvas (the
    // on-screen canvas is already showing this state).
    const canvas = document.createElement('canvas');
    canvas.width = state.width;
    canvas.height = state.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (format === 'jpeg') {
      // JPEG has no alpha; paint a background first.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, state.width, state.height);
    }
    state.layers.forEach((layer) => renderLayer({ ctx, width: state.width, height: state.height }, layer));
    if (format === 'bmp') {
      // Browsers don't expose image/bmp; encode the RGBA buffer
      // ourselves via @placeholderer/core's encodeBmp.
      const imageData = ctx.getImageData(0, 0, state.width, state.height);
      const bmpBytes = encodeBmp(imageData.data, state.width, state.height);
      // Allocate a real ArrayBuffer + copy so the Blob constructor
      // (strict about ArrayBuffer vs SharedArrayBuffer) accepts it.
      const ab = new ArrayBuffer(bmpBytes.byteLength);
      new Uint8Array(ab).set(bmpBytes);
      download(new Blob([ab], { type: 'image/bmp' }), 'ui-placeholder.bmp');
      return;
    }
    if (format === 'gif') {
      // Browsers don't expose image/gif either; encode through our
      // own GIF89a serializer.
      const imageData = ctx.getImageData(0, 0, state.width, state.height);
      const gifBytes = encodeGif(imageData.data, state.width, state.height);
      const ab = new ArrayBuffer(gifBytes.byteLength);
      new Uint8Array(ab).set(gifBytes);
      download(new Blob([ab], { type: 'image/gif' }), 'ui-placeholder.gif');
      return;
    }
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime));
    if (blob) download(blob, `ui-placeholder.${format === 'jpeg' ? 'jpg' : 'png'}`);
  };

  const exportRecipe = () => {
    const recipe = {
      canvasMode: 'compact',
      width: state.width,
      height: state.height,
      gridSize: state.gridSize,
      snapEnabled: state.snapEnabled,
      layers: state.layers,
    };
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' });
    download(blob, 'builder-recipe.json');
  };

  const importRecipe = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = validateBuilderRecipe(data);
        if (!result.valid) {
          alert('Invalid recipe: ' + result.errors.map((er: { path: string; message: string }) => `${er.path}: ${er.message}`).join('\n'));
          return;
        }
        const layers = (data.layers ?? []) as Layer[];
        pushHistory({
          ...state,
          width: data.width ?? state.width,
          height: data.height ?? state.height,
          gridSize: data.gridSize ?? state.gridSize,
          snapEnabled: data.snapEnabled ?? state.snapEnabled,
          layers,
        });
        setSelectedId(null);
        setEditingRecipe(false);
      } catch (err: any) {
        alert('Could not parse recipe JSON: ' + err.message);
      }
    };
    input.click();
  };

  const clearRecipe = () => {
    if (!confirm('Discard the current recipe and start over? This cannot be undone.')) return;
    startFromScratch();
  };

  // Mouse interactions
  const getMouse = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x: mx, y: my } = getMouse(e);
    if (e.shiftKey && selectedId) {
      const sel = state.layers.find((l) => l.id === selectedId);
      if (sel) {
        const handle = getResizeHandle(sel, mx, my);
        if (handle) {
          isInteracting.current = { mode: 'resize', resizeHandle: handle, offsetX: 0, offsetY: 0, startW: sel.width ?? 0, startH: sel.height ?? 0, preState: state };
          return;
        }
      }
    }
    const hit = [...state.layers].reverse().find((l) => {
      if (l.locked || !l.visible) return false;
      const lx = l.x ?? 0, ly = l.y ?? 0, lw = l.width ?? 0, lh = l.height ?? 0;
      return mx >= lx && mx <= lx + lw && my >= ly && my <= ly + lh;
    });
    if (!hit) { setSelectedId(null); return; }
    setSelectedId(hit.id);
    isInteracting.current = {
      mode: 'move',
      offsetX: mx - (hit.x ?? 0),
      offsetY: my - (hit.y ?? 0),
      startW: hit.width ?? 0,
      startH: hit.height ?? 0,
      preState: state,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x: mx, y: my } = getMouse(e);
    const interact = isInteracting.current;

    if (interact.mode === 'move' && selectedId) {
      const newX = snap(mx - interact.offsetX);
      const newY = snap(my - interact.offsetY);
      setState((s) => ({
        ...s,
        layers: s.layers.map((l) => l.id === selectedId ? ({ ...l, x: newX, y: newY } as Layer) : l),
      }));
      return;
    }
    if (interact.mode === 'resize' && selectedId && interact.resizeHandle) {
      const sel = state.layers.find((l) => l.id === selectedId);
      if (!sel) return;
      let { x, y, width, height } = { x: sel.x ?? 0, y: sel.y ?? 0, width: sel.width ?? 0, height: sel.height ?? 0 };
      const handle = interact.resizeHandle;
      if (handle === 'left' || handle === 'corner') {
        const newRight = x + width;
        x = Math.min(snap(mx), newRight - 8);
        width = newRight - x;
      }
      if (handle === 'right' || handle === 'corner') {
        width = Math.max(8, snap(mx) - x);
      }
      if (handle === 'top' || handle === 'corner') {
        const newBottom = y + height;
        y = Math.min(snap(my), newBottom - 8);
        height = newBottom - y;
      }
      if (handle === 'bottom' || handle === 'corner') {
        height = Math.max(8, snap(my) - y);
      }
      setState((s) => ({
        ...s,
        layers: s.layers.map((l) => l.id === selectedId ? ({ ...l, x, y, width, height } as Layer) : l),
      }));
    }
  };

  const handleMouseUp = () => {
    if (isInteracting.current.mode && isInteracting.current.preState) {
      // Snapshot the PRE-gesture state into history so undo actually
      // restores the position the user started from, not the post-drag
      // position (which is what 'state' holds by now).
      const pre = isInteracting.current.preState;
      setHistory((h) => {
        const trimmed = h.length >= HISTORY_LIMIT ? h.slice(1) : h;
        return [...trimmed, pre];
      });
      setFuture([]);
    }
    isInteracting.current = { mode: null, offsetX: 0, offsetY: 0, startW: 0, startH: 0, preState: null };
  };

  const selectedLayer = state.layers.find((l) => l.id === selectedId) ?? null;

  // Engine-aware presets grouped by engine for the preset picker.
  // The factory closes the popover and refuses to apply when the
  // user has unsaved layers — they have to Clear first if they
  // want a clean slate, otherwise the preset appends.
  const presets = PRESETS.map((p) => ({
    name: p.name,
    engine: p.engine,
    factory: () => {
      setPresetsOpen(false);
      const layers: Layer[] = p.layers.map((l) => ({ ...l, id: makeId() }));
      pushHistory({
        ...state,
        width: p.width,
        height: p.height,
        layers: [...state.layers, ...layers],
      });
    },
  }));

  return (
    <div style={{ padding: '1rem', color: colors.text, height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>UI Builder</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={undo} disabled={history.length === 0} style={btnSecondary(colors)}>Undo ({history.length})</button>
          <button onClick={redo} disabled={future.length === 0} style={btnSecondary(colors)}>Redo ({future.length})</button>
          <button onClick={startFromScratch} style={btnSecondary(colors)}>Start from Scratch</button>
          <button onClick={importRecipe} style={btnSecondary(colors)}>Import Recipe</button>
          <button onClick={exportRecipe} style={btnSecondary(colors)}>Export Recipe</button>
          <button onClick={() => exportImage('png')} style={btnAccent(colors)}>Export PNG</button>
          <button onClick={() => exportImage('jpeg')} style={btnAccent(colors)}>Export JPG</button>
          <button onClick={() => exportImage('bmp')} style={btnAccent(colors)}>Export BMP</button>
          <button onClick={() => exportImage('gif')} style={btnAccent(colors)}>Export GIF</button>
          <button onClick={() => exportImage('svg')} style={btnAccent(colors)}>Export SVG</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem', background: colors.bgElevated, border: `1px solid ${colors.border}`, borderRadius: '6px', flexWrap: 'wrap', position: 'relative' }}>
        <span style={{ fontSize: '0.9rem', color: colors.textMuted }}>Canvas:</span>
        <input type="number" value={state.width} onChange={(e) => setState((s) => ({ ...s, width: Math.max(50, parseInt(e.target.value) || 50) }))} style={numInputStyle(colors)} />
        <span>×</span>
        <input type="number" value={state.height} onChange={(e) => setState((s) => ({ ...s, height: Math.max(50, parseInt(e.target.value) || 50) }))} style={numInputStyle(colors)} />
        <span style={{ fontSize: '0.9rem', color: colors.textMuted, marginLeft: '1rem' }}>Grid:</span>
        <input type="number" value={state.gridSize} onChange={(e) => setState((s) => ({ ...s, gridSize: Math.max(2, parseInt(e.target.value) || 2) }))} style={numInputStyle(colors)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={state.snapEnabled} onChange={(e) => setState((s) => ({ ...s, snapEnabled: e.target.checked }))} />
          Snap
        </label>
        <button onClick={clearRecipe} style={{ ...btnSecondary(colors), marginLeft: 'auto' }}>Clear</button>
        <button data-presets-trigger onClick={() => setPresetsOpen((o) => !o)} style={btnSecondary(colors)} aria-expanded={presetsOpen} aria-haspopup="dialog">
          Presets
        </button>
        {presetsOpen && (
          <div
            role="dialog"
            aria-label="Engine-aware presets"
            data-presets-popover
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.25rem)',
              right: 0,
              width: 320,
              maxHeight: '70vh',
              overflowY: 'auto',
              background: colors.bgElevated,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: '0.75rem',
              boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.3)',
              zIndex: 50,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong style={{ fontSize: '0.85rem' }}>Pick a preset</strong>
              <button
                onClick={() => setPresetsOpen(false)}
                style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}
                aria-label="Close presets"
              >
                ×
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginBottom: '0.75rem' }}>
              Appending layers and resizing the canvas. Use Clear first to start over.
            </div>
            {(['Godot', 'Unity', 'Unreal', 'Common'] as const).map((engine) => {
              const enginePresets = presets.filter((p) => p.engine === engine);
              if (enginePresets.length === 0) return null;
              return (
                <div key={engine} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: colors.textDim, marginBottom: '0.25rem' }}>{engine}</div>
                  {enginePresets.map((p) => (
                    <button
                      key={p.name}
                      onClick={p.factory}
                      style={{ ...btnSecondary(colors), marginRight: '0.25rem', marginBottom: '0.25rem', fontSize: '0.8rem' }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '2rem', height: 'calc(100% - 130px)' }}>
        <div ref={containerRef} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start' }}>
          <div>
            <canvas
              ref={canvasRef}
              width={state.width}
              height={state.height}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'default',
                background: colors.bgInset,
                maxWidth: '100%',
                height: 'auto',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <div style={{ fontSize: '0.75rem', color: colors.textDim, marginTop: '0.5rem' }}>
              Click to select • Drag to move • <strong>Shift + Drag edge</strong> = Resize • <strong>Ctrl/⌘+Z</strong> = Undo • <strong>Delete</strong> = Remove layer
            </div>
          </div>
        </div>

        <div style={{ width: 320, flexShrink: 0, overflowY: 'auto' }}>
          {/* Add controls */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => addLayer(() => rectLayer({ name: 'Rectangle', x: 80, y: 80, width: 140, height: 80 }))} style={btnSecondary(colors)}>+ Rect</button>
            <button onClick={() => addLayer(() => circleLayer({ name: 'Circle', x: 80, y: 80, width: 80, height: 80 }))} style={btnSecondary(colors)}>+ Circle</button>
            <button onClick={() => addLayer(() => lineLayer({ name: 'Line', x: 80, y: 100, width: 200, height: 4 }))} style={btnSecondary(colors)}>+ Line</button>
            <button onClick={() => addLayer(() => filledShapeLayer({ name: 'Rounded', x: 80, y: 80, width: 140, height: 80 }))} style={btnSecondary(colors)}>+ Rounded</button>
            <button onClick={() => addLayer(() => textLayer({ name: 'Text', x: 80, y: 100, width: 200, height: 40, content: 'Text' }))} style={btnSecondary(colors)}>+ Text</button>
            <button onClick={importRaster} style={btnSecondary(colors)}>Import Image</button>
          </div>

          {/* Presets are exposed via the Presets button next to Clear. */}

          {/* Layers */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: colors.textDim, marginBottom: '0.5rem' }}>Layers</div>
            {[...state.layers].reverse().map((layer) => (
              <div key={layer.id} style={{
                padding: '0.5rem 0.6rem',
                background: selectedId === layer.id ? colors.accent : colors.bgElevated,
                color: selectedId === layer.id ? '#fff' : colors.text,
                marginBottom: '0.25rem',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '0.85rem',
                opacity: layer.visible ? 1 : 0.5,
              }}>
                <span onClick={() => setSelectedId(layer.id)} style={{ flex: 1 }}>
                  {renamingId === layer.id ? (
                    <input
                      autoFocus
                      defaultValue={layer.name}
                      onBlur={(e) => { updateLayer(layer.id, { name: e.target.value || layer.name }); setRenamingId(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={{ width: '90%', background: 'transparent', color: 'inherit', border: 'none', outline: 'none' }}
                    />
                  ) : (
                    <span onDoubleClick={() => setRenamingId(layer.id)}>{layer.name}</span>
                  )}
                  {' '}
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{layer.type}{layer.locked ? ' 🔒' : ''}</span>
                </span>
                <span style={{ display: 'flex', gap: '0.2rem' }}>
                  <IconBtn label="↑" onClick={() => moveLayer(layer.id, 'up')} />
                  <IconBtn label="↓" onClick={() => moveLayer(layer.id, 'down')} />
                  <IconBtn label="⎘" onClick={() => duplicateLayer(layer.id)} />
                  <IconBtn label="×" onClick={() => deleteLayer(layer.id)} />
                </span>
              </div>
            ))}
          </div>

          {/* Properties */}
          {selectedLayer && <PropertiesPanel layer={selectedLayer} onUpdate={(u) => updateLayer(selectedLayer.id, u)} colors={colors} />}
        </div>
      </div>
    </div>
  );
}

function getResizeHandle(layer: Layer, mx: number, my: number): string | null {
  const x = layer.x ?? 0, y = layer.y ?? 0, w = layer.width ?? 0, h = layer.height ?? 0;
  const T = 8;
  const nearLeft = Math.abs(mx - x) < T;
  const nearRight = Math.abs(mx - (x + w)) < T;
  const nearTop = Math.abs(my - y) < T;
  const nearBottom = Math.abs(my - (y + h)) < T;
  if ((nearLeft || nearRight) && (nearTop || nearBottom)) return 'corner';
  if (nearLeft) return 'left';
  if (nearRight) return 'right';
  if (nearTop) return 'top';
  if (nearBottom) return 'bottom';
  return null;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function btnSecondary(colors: typeof import('./colors').colors) {
  return {
    padding: '0.4rem 0.8rem',
    background: colors.bgInset,
    color: colors.text,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer' as const,
    fontSize: '0.85rem',
  };
}
function btnAccent(colors: typeof import('./colors').colors) {
  return { ...btnSecondary(colors), background: colors.accent, color: '#fff' };
}
function numInputStyle(colors: typeof import('./colors').colors) {
  return {
    width: '70px',
    padding: '0.3rem',
    background: colors.bgInset,
    color: colors.text,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: '4px',
  };
}

function IconBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none', color: 'inherit',
      cursor: 'pointer', padding: '0 0.2rem', fontSize: '0.85rem',
    }}>{label}</button>
  );
}

interface PropertiesPanelProps {
  layer: Layer;
  onUpdate: (updates: Partial<Layer>) => void;
  colors: typeof import('./colors').colors;
}

function PropertiesPanel({ layer, onUpdate, colors }: PropertiesPanelProps) {
  const fillColor = typeof layer.fill === 'string' ? layer.fill : '#4A5568';
  const strokeColor = layer.stroke?.color ?? '';
  const shadowBlur = layer.effects?.shadow?.blur ?? '';
  const shadowColor = layer.effects?.shadow?.color ?? '';

  return (
    <div style={{ marginTop: '1rem', padding: '0.75rem', background: colors.bgElevated, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
      <div style={{ fontSize: '0.85rem', color: colors.textMuted, marginBottom: '0.6rem' }}>Properties — {layer.name} ({layer.type})</div>

      <Field label="Name">
        <input value={layer.name} onChange={(e) => onUpdate({ name: e.target.value })} style={inputStyle(colors)} />
      </Field>

      <Field label="X / Y">
        <input type="number" value={layer.x ?? 0} onChange={(e) => onUpdate({ x: parseInt(e.target.value) || 0 })} style={inputStyle(colors)} />
        <input type="number" value={layer.y ?? 0} onChange={(e) => onUpdate({ y: parseInt(e.target.value) || 0 })} style={inputStyle(colors)} />
      </Field>

      <Field label="Width / Height">
        <input type="number" value={layer.width ?? 0} onChange={(e) => onUpdate({ width: parseInt(e.target.value) || 0 })} style={inputStyle(colors)} />
        <input type="number" value={layer.height ?? 0} onChange={(e) => onUpdate({ height: parseInt(e.target.value) || 0 })} style={inputStyle(colors)} />
      </Field>

      <Field label="Rotation">
        <input type="number" value={layer.rotation ?? 0} onChange={(e) => onUpdate({ rotation: parseFloat(e.target.value) || 0 })} style={inputStyle(colors)} />
      </Field>

      <Field label="Fill mode">
        <select
          value={typeof layer.fill === 'string' || !layer.fill ? 'solid' : (layer.fill as any).type ?? 'solid'}
          onChange={(e) => {
            const mode = e.target.value;
            if (mode === 'solid') onUpdate({ fill: '#4A5568' });
            else if (mode === 'pattern') onUpdate({ fill: { type: 'pattern', pattern: 'checkerboard' } });
            else if (mode === 'image') onUpdate({ fill: { type: 'image', src: '', mode: 'repeat' } });
          }}
          style={inputStyle(colors)}
        >
          <option value="solid">Solid</option>
          <option value="pattern">Pattern</option>
          <option value="image">Image</option>
        </select>
      </Field>

      {typeof layer.fill === 'object' && layer.fill && (layer.fill as any).type === 'pattern' && (
        <Field label="Pattern">
          <select
            value={(layer.fill as any).pattern}
            onChange={(e) => onUpdate({ fill: { type: 'pattern', pattern: e.target.value as any } })}
            style={inputStyle(colors)}
          >
            <option value="checkerboard">Checkerboard</option>
            <option value="stripes">Stripes</option>
            <option value="diagonal">Diagonal</option>
          </select>
        </Field>
      )}

      {typeof layer.fill === 'object' && layer.fill && (layer.fill as any).type === 'image' && (
        <>
          <Field label="Image src" wide>
            <input value={(layer.fill as any).src ?? ''} onChange={(e) => onUpdate({ fill: { type: 'image', src: e.target.value, mode: (layer.fill as any).mode ?? 'repeat' } })} style={inputStyle(colors)} />
          </Field>
          <Field label="Mode">
            <select
              value={(layer.fill as any).mode ?? 'repeat'}
              onChange={(e) => onUpdate({ fill: { type: 'image', src: (layer.fill as any).src ?? '', mode: e.target.value as any } })}
              style={inputStyle(colors)}
            >
              <option value="repeat">Repeat</option>
              <option value="stretch">Stretch</option>
            </select>
          </Field>
        </>
      )}

      {(typeof layer.fill === 'string' || !layer.fill) && (
        <Field label="Fill color">
          <input type="color" value={fillColor} onChange={(e) => onUpdate({ fill: e.target.value })} style={{ ...inputStyle(colors), padding: 0, height: 28 }} />
        </Field>
      )}

      <Field label="Stroke color">
        <input type="color" value={strokeColor || '#000000'} onChange={(e) => onUpdate({ stroke: { ...(layer.stroke ?? {}), color: e.target.value } })} style={{ ...inputStyle(colors), padding: 0, height: 28 }} />
      </Field>

      <Field label="Stroke width">
        <input type="number" value={layer.stroke?.width ?? 0} min={0} onChange={(e) => onUpdate({ stroke: { ...(layer.stroke ?? {}), color: layer.stroke?.color ?? '#000000', width: parseInt(e.target.value) || 0 } })} style={inputStyle(colors)} />
      </Field>

      <Field label="Shadow blur">
        <input type="number" value={shadowBlur} min={0} onChange={(e) => onUpdate({ effects: { ...(layer.effects ?? {}), shadow: { ...(layer.effects?.shadow ?? {}), blur: parseInt(e.target.value) || 0, color: shadowColor || 'rgba(0,0,0,0.5)' } } })} style={inputStyle(colors)} />
      </Field>

      <Field label="Glow blur">
        <input
          type="number"
          value={layer.effects?.glow?.blur ?? ''}
          min={0}
          onChange={(e) => {
            const v = parseInt(e.target.value) || 0;
            if (v === 0) {
              const { glow, ...rest } = layer.effects ?? {};
              onUpdate({ effects: Object.keys(rest).length ? rest : undefined });
            } else {
              onUpdate({ effects: { ...(layer.effects ?? {}), glow: { blur: v, color: layer.effects?.glow?.color ?? 'rgba(255,255,255,0.6)' } } });
            }
          }}
          style={inputStyle(colors)}
        />
      </Field>

      {layer.effects?.glow && (
        <Field label="Glow color">
          <input
            type="color"
            value={glowColorToHex(layer.effects.glow.color)}
            onChange={(e) => {
              const effects = layer.effects ?? {};
              const glow = effects.glow ?? { blur: 8 };
              onUpdate({ effects: { ...effects, glow: { ...glow, color: hexToRgba(e.target.value, glow.color) } } });
            }}
            style={{ ...inputStyle(colors), padding: 0, height: 28 }}
          />
        </Field>
      )}

      <Field label="Opacity">
        <input type="range" min="0" max="1" step="0.05" value={layer.opacity ?? 1} onChange={(e) => onUpdate({ opacity: parseFloat(e.target.value) })} style={{ width: '100%' }} />
      </Field>

      <Field label="Blend mode">
        <select value={layer.blendMode ?? 'source-over'} onChange={(e) => onUpdate({ blendMode: e.target.value as BlendMode })} style={inputStyle(colors)}>
          {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </Field>

      {layer.type === 'text' && (
        <Field label="Text content" wide>
          <input
            value={layer.text?.content ?? ''}
            onChange={(e) => onUpdate({ text: { ...(layer.text ?? { content: '', fontSize: 24 }), content: e.target.value } })}
            style={inputStyle(colors)}
          />
        </Field>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <input type="checkbox" checked={layer.visible} onChange={(e) => onUpdate({ visible: e.target.checked })} /> Visible
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <input type="checkbox" checked={layer.locked} onChange={(e) => onUpdate({ locked: e.target.checked })} /> Locked
        </label>
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      style={{
        marginBottom: '0.5rem',
        display: wide ? 'block' : 'grid',
        gridTemplateColumns: wide ? undefined : '90px 1fr 1fr',
        gap: '0.3rem',
        alignItems: 'center',
      }}
    >
      <label style={{ fontSize: '0.75rem', color: colors.textMuted }}>{label}</label>
      {children}
    </div>
  );
}

/** Convert any CSS color to a #rrggbb hex so a native color picker
 *  can edit it. Falls back to white if we can't parse it. */
function glowColorToHex(color: string | undefined): string {
  if (!color) return '#ffffff';
  if (color.startsWith('#')) {
    if (color.length === 7) return color;
    if (color.length === 4) {
      return '#' + color.slice(1).split('').map((c) => c + c).join('');
    }
    return color.slice(0, 7);
  }
  return '#ffffff';
}

/** Convert a hex color picked by the native input to an rgba string,
 *  preserving the alpha of an existing glow color when present. */
export function hexToRgba(hex: string, existing: string | undefined): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return existing ?? 'rgba(255,255,255,0.6)';
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  // Only carry the alpha forward when the existing color is a
  // true rgba(...)/hsla(...) value with a 4th component. For
  // rgb(...) / hsl(...) / hex without alpha, the regex would
  // otherwise grab the last numeric component and treat it as
  // alpha (e.g. rgb(10,20,30) would extract "30" and produce
  // rgba(...,...,...,30), which is outside the valid 0..1 range
  // and silently fails to render).
  const alphaMatch = existing
    ? existing.match(/^rgba?\([^)]*\)\s*$/) || existing.match(/^hsla?\([^)]*\)\s*$/)
    : null;
  let alpha = '0.6';
  if (alphaMatch) {
    const nums = existing!.match(/-?\d*\.?\d+/g);
    if (nums && nums.length === 4) alpha = nums[3];
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

function inputStyle(colors: typeof import('./colors').colors) {
  return {
    width: '100%',
    padding: '0.3rem',
    background: colors.bgInset,
    color: colors.text,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: '4px',
  };
}
