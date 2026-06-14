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
    { id: 'bg', type: 'rect', name: 'Background', visible: true, locked: true, x: 0, y: 0, width: 600, height: 400, color: '#2D3748', opacity: 1, blendMode: 'source-over' },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const selectedLayer = layers.find(l => l.id === selectedId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#2a2a3a';
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
        ctx.strokeStyle = '#4A5568';
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
      ctx.strokeStyle = '#63b3ed';
      ctx.lineWidth = 2;
      ctx.strokeRect(selectedLayer.x - 2, selectedLayer.y - 2, selectedLayer.width + 4, selectedLayer.height + 4);
    }
  }, [layers, selectedId]);

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
      { id: 'bg', type: 'rect', name: 'Background', visible: true, locked: true, x: 0, y: 0, width: 600, height: 400, color: '#2D3748', opacity: 1, blendMode: 'source-over' },
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

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2>UI Builder</h2>
        <div>
          <button onClick={startFromScratch}>Start from Scratch</button>
          <button onClick={exportPNG}>Export PNG</button>
          <button onClick={exportRecipe}>Export Recipe</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div>
          <canvas 
            ref={canvasRef} 
            width={600} 
            height={400}
            style={{ border: '1px solid #444', cursor: 'crosshair' }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const clickY = e.clientY - rect.top;
              const hit = [...layers].reverse().find(l => 
                clickX >= l.x && clickX <= l.x + l.width &&
                clickY >= l.y && clickY <= l.y + l.height
              );
              setSelectedId(hit?.id || null);
            }}
          />
        </div>

        <div style={{ width: 320 }}>
          <div style={{ marginBottom: '1rem' }}>
            <button onClick={() => addLayer('rect')}>+ Rect</button>
            <button onClick={() => addLayer('text')}>+ Text</button>
            <button onClick={importRaster}>Import Image</button>
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <strong>Presets:</strong>
            {presets.map(p => (
              <button key={p.name} onClick={() => addLayer(p.type as any, p)} style={{ marginLeft: '0.25rem' }}>
                {p.name}
              </button>
            ))}
          </div>

          <h4>Layers</h4>
          {layers.map(layer => (
            <div 
              key={layer.id}
              onClick={() => setSelectedId(layer.id)}
              style={{ 
                padding: '0.5rem', 
                background: selectedId === layer.id ? '#2a2a3a' : '#1f1f2e',
                marginBottom: '0.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <span>{layer.name}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}>×</button>
            </div>
          ))}

          {selectedLayer && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4>Properties</h4>
              <input 
                type="color" 
                value={selectedLayer.color}
                onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
              />
              {selectedLayer.type === 'text' && (
                <input 
                  type="text"
                  value={selectedLayer.text || ''}
                  onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                  style={{ display: 'block', marginTop: '0.5rem' }}
                />
              )}
              <div style={{ marginTop: '0.75rem' }}>
                <label>Opacity</label>
                <input 
                  type="range" 
                  min="0" max="1" step="0.05"
                  value={selectedLayer.opacity ?? 1}
                  onChange={(e) => updateLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <label>Blend Mode</label>
                <select 
                  value={selectedLayer.blendMode || 'source-over'}
                  onChange={(e) => updateLayer(selectedLayer.id, { blendMode: e.target.value })}
                >
                  <option value="source-over">Normal</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                  <option value="overlay">Overlay</option>
                </select>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <label>
                  <input 
                    type="checkbox"
                    checked={selectedLayer.visible}
                    onChange={(e) => updateLayer(selectedLayer.id, { visible: e.target.checked })}
                  /> Visible
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}