import { useState, useRef, useEffect } from 'react';

interface Layer {
  id: string;
  type: 'rect' | 'text' | 'raster';
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text?: string;
  imageData?: string;
  opacity?: number;
  blendMode?: string;
}

const presets = [
  { name: 'Button', type: 'rect', w: 160, h: 48, color: '#4A5568' },
  { name: 'Panel', type: 'rect', w: 400, h: 240, color: '#2D3748' },
  { name: 'Title Text', type: 'text', w: 200, h: 40, color: '#ffffff' },
];

export function UIBuilder() {
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'bg', type: 'rect', name: 'Background', visible: true, locked: true, x: 0, y: 0, width: 1400, height: 900, color: '#2D3748', opacity: 1, blendMode: 'source-over' },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [canvasSize, setCanvasSize] = useState({ width: 1400, height: 900 });

  // Responsive sizing
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const availableWidth = Math.max(container.offsetWidth - 60, 800);
        const availableHeight = Math.max(window.innerHeight - 220, 600);

        const width = Math.min(availableWidth, 1800);
        const height = Math.min(availableHeight, Math.floor(width * 0.7));

        setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  const selectedLayer = layers.find(l => l.id === selectedId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1e2937';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    layers.forEach(layer => {
      if (!layer.visible) return;
      ctx.globalAlpha = layer.opacity ?? 1;
      ctx.globalCompositeOperation = (layer.blendMode as any) || 'source-over';

      if (layer.type === 'rect') {
        ctx.fillStyle = layer.color;
        ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
      }
      if (layer.type === 'text' && layer.text) {
        ctx.font = 'bold 24px system-ui';
        ctx.fillStyle = layer.color;
        ctx.fillText(layer.text, layer.x, layer.y + 24);
      }
      if (layer.type === 'raster' && layer.imageData) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
        img.src = layer.imageData;
      }
    });

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (selectedLayer) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(selectedLayer.x - 2, selectedLayer.y - 2, selectedLayer.width + 4, selectedLayer.height + 4);
    }
  }, [layers, selectedId, canvasSize]);

  const addLayer = (type: 'rect' | 'text' | 'raster', preset?: any) => {
    const newLayer: Layer = {
      id: Date.now().toString(),
      type,
      name: preset?.name || type.charAt(0).toUpperCase() + type.slice(1),
      visible: true,
      locked: false,
      x: 80 + layers.length * 25,
      y: 80 + layers.length * 25,
      width: preset?.w || (type === 'rect' ? 140 : 120),
      height: preset?.h || (type === 'rect' ? 80 : 40),
      color: preset?.color || '#4A5568',
      text: type === 'text' ? 'Text' : undefined,
      opacity: 1,
      blendMode: 'source-over',
    };
    setLayers([...layers, newLayer]);
    setSelectedId(newLayer.id);
  };

  const startFromScratch = () => {
    setLayers([
      { id: 'bg', type: 'rect', name: 'Background', visible: true, locked: true, x: 0, y: 0, width: canvasSize.width, height: canvasSize.height, color: '#2D3748', opacity: 1, blendMode: 'source-over' },
    ]);
    setSelectedId(null);
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setLayers(layers.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const deleteLayer = (id: string) => {
    setLayers(layers.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const importRaster = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newLayer: Layer = {
          id: Date.now().toString(),
          type: 'raster',
          name: file.name,
          visible: true,
          locked: false,
          x: 120,
          y: 120,
          width: 200,
          height: 150,
          color: '#ffffff',
          imageData: ev.target?.result as string,
          opacity: 1,
          blendMode: 'source-over',
        };
        setLayers([...layers, newLayer]);
        setSelectedId(newLayer.id);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'ui-placeholder.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportRecipe = () => {
    const recipe = { canvasMode: 'compact', layers };
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'builder-recipe.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Enhanced click handler with modifier keys
  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const hitLayer = [...layers].reverse().find(l => 
      clickX >= l.x && clickX <= l.x + l.width &&
      clickY >= l.y && clickY <= l.y + l.height
    );

    if (!hitLayer) {
      setSelectedId(null);
      return;
    }

    // Control + Click → Send to back
    if (e.ctrlKey) {
      const newLayers = layers.filter(l => l.id !== hitLayer.id);
      setLayers([hitLayer, ...newLayers]);
      return;
    }

    // Alt + Click → Send to front
    if (e.altKey) {
      const newLayers = layers.filter(l => l.id !== hitLayer.id);
      setLayers([...newLayers, hitLayer]);
      return;
    }

    // Shift + Click on edge → Resize mode (simple implementation)
    if (e.shiftKey) {
      const edgeThreshold = 20;
      const isNearRight = Math.abs(clickX - (hitLayer.x + hitLayer.width)) < edgeThreshold;
      const isNearBottom = Math.abs(clickY - (hitLayer.y + hitLayer.height)) < edgeThreshold;

      if (isNearRight || isNearBottom) {
        const newWidth = isNearRight ? Math.max(50, clickX - hitLayer.x) : hitLayer.width;
        const newHeight = isNearBottom ? Math.max(30, clickY - hitLayer.y) : hitLayer.height;
        
        updateLayer(hitLayer.id, { width: newWidth, height: newHeight });
        setSelectedId(hitLayer.id);
        return;
      }
    }

    // Normal click → Select
    setSelectedId(hitLayer.id);
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedLayer || e.shiftKey || e.ctrlKey || e.altKey) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (
      mouseX >= selectedLayer.x &&
      mouseX <= selectedLayer.x + selectedLayer.width &&
      mouseY >= selectedLayer.y &&
      mouseY <= selectedLayer.y + selectedLayer.height
    ) {
      setIsDragging(true);
      setDragOffset({ x: mouseX - selectedLayer.x, y: mouseY - selectedLayer.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedLayer || !selectedId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    updateLayer(selectedId, {
      x: mouseX - dragOffset.x,
      y: mouseY - dragOffset.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div style={{ padding: '1rem', color: '#e2e8f0', height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>UI Builder</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={startFromScratch} style={{ padding: '0.5rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px' }}>
            Start from Scratch
          </button>
          <button onClick={exportPNG} style={{ padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px' }}>
            Export PNG
          </button>
          <button onClick={exportRecipe} style={{ padding: '0.5rem 1rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px' }}>
            Export Recipe
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', height: 'calc(100% - 50px)' }}>
        <div ref={containerRef} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start' }}>
          <div>
            <canvas 
              ref={canvasRef} 
              width={canvasSize.width} 
              height={canvasSize.height}
              style={{ 
                border: '1px solid #334155', 
                borderRadius: '8px',
                cursor: isDragging ? 'grabbing' : 'grab',
                background: '#0f172a',
                maxWidth: '100%',
                height: 'auto',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleCanvasClick}
            />
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              Click to select • Drag to move • <strong>Shift+Click</strong> on edge = Resize • <strong>Ctrl+Click</strong> = Send to back • <strong>Alt+Click</strong> = Send to front
            </div>
          </div>
        </div>

        <div style={{ width: 320, flexShrink: 0 }}>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => addLayer('rect')} style={{ padding: '0.4rem 0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px' }}>+ Rectangle</button>
            <button onClick={() => addLayer('text')} style={{ padding: '0.4rem 0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px' }}>+ Text</button>
            <button onClick={importRaster} style={{ padding: '0.4rem 0.8rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px' }}>Import Image</button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>Presets</div>
            {presets.map(p => (
              <button key={p.name} onClick={() => addLayer(p.type as any, p)} style={{ marginRight: '0.4rem', marginBottom: '0.4rem', padding: '0.35rem 0.7rem', background: '#1e2937', color: '#fff', border: '1px solid #475569', borderRadius: '4px', fontSize: '0.85rem' }}>
                {p.name}
              </button>
            ))}
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>Layers</div>
            {layers.map(layer => (
              <div key={layer.id} onClick={() => setSelectedId(layer.id)} style={{ padding: '0.6rem 0.75rem', background: selectedId === layer.id ? '#1e40af' : '#1e2937', marginBottom: '0.25rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                <span>{layer.name}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>×</button>
              </div>
            ))}
          </div>

          {selectedLayer && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#1e2937', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.75rem' }}>Properties — {selectedLayer.name}</div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Color</label>
                <input type="color" value={selectedLayer.color} onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })} style={{ width: '100%' }} />
              </div>
              {selectedLayer.type === 'text' && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Text</label>
                  <input type="text" value={selectedLayer.text || ''} onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })} style={{ width: '100%', padding: '0.4rem', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '4px' }} />
                </div>
              )}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Opacity</label>
                <input type="range" min="0" max="1" step="0.05" value={selectedLayer.opacity ?? 1} onChange={(e) => updateLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Blend Mode</label>
                <select value={selectedLayer.blendMode || 'source-over'} onChange={(e) => updateLayer(selectedLayer.id, { blendMode: e.target.value })} style={{ width: '100%', padding: '0.4rem', background: '#0f172a', color: '#fff', border: '1px solid #475569', borderRadius: '4px' }}>
                  <option value="source-over">Normal</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                  <option value="overlay">Overlay</option>
                </select>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={selectedLayer.visible} onChange={(e) => updateLayer(selectedLayer.id, { visible: e.target.checked })} /> Visible
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}