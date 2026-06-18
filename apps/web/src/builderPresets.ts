// Engine-aware UI Builder preset library.
//
// Each preset is a recipe: a list of layers that, when applied to the
// current builder state, seeds a useful starting point. Per the v1
// spec, these should be engine-aware so a Godot dialog and a Unity
// health bar differ in dimensions, naming, and structure.

import type { Layer } from '@placeholderer/schemas';
import { rectLayer, textLayer, lineLayer } from './builderLayerFactories';

let nextId = 1000;
const id = (): string => `preset-${nextId++}`;

export interface BuilderPreset {
  id: string;
  engine: 'Godot' | 'Unity' | 'Unreal' | 'Common';
  category: 'panel' | 'button' | 'bar' | 'indicator' | 'divider' | 'text';
  name: string;
  layers: Layer[];
  width: number;
  height: number;
}

function makeId(): string {
  return id();
}

/** Godot panel: outer dark frame, inner lighter panel, title text,
 *  and a divider. Sized to Godot's typical 9-slice-friendly 96px base. */
const godotDialog: BuilderPreset = {
  id: makeId(),
  engine: 'Godot',
  category: 'panel',
  name: 'Dialog Window',
  width: 320,
  height: 160,
  layers: [
    rectLayer({ id: 'bg', name: 'Background', x: 0, y: 0, width: 320, height: 160, fill: '#1A202C', locked: true }),
    rectLayer({ id: 'panel', name: 'Panel', x: 8, y: 8, width: 304, height: 144, fill: '#2D3748' }),
    textLayer({ id: 'title', name: 'Title', x: 20, y: 24, width: 280, height: 28, content: 'NPC says hello', fill: '#F7FAFC' }),
    lineLayer({ id: 'divider', name: 'Divider', x: 20, y: 60, width: 280, height: 2, stroke: { color: '#4A5568', width: 1 } }),
    textLayer({ id: 'body', name: 'Body', x: 20, y: 72, width: 280, height: 64, content: 'It is dangerous to go alone. Take this.', fill: '#CBD5E0' }),
  ],
};

/** Unity health bar: a frame rect with a fill bar layered on top. */
const unityHealthBar: BuilderPreset = {
  id: makeId(),
  engine: 'Unity',
  category: 'bar',
  name: 'Health Bar',
  width: 200,
  height: 24,
  layers: [
    rectLayer({ id: 'frame', name: 'Frame', x: 0, y: 0, width: 200, height: 24, fill: '#1A1A1A' }),
    rectLayer({ id: 'fill', name: 'Fill', x: 2, y: 2, width: 160, height: 20, fill: '#DC2626' }),
  ],
};

/** Unreal HUD crosshair: a center plus shape. The vertical arm
 *  has to be a thin rectangle — lineLayer is always horizontal
 *  (height only moves the y-center, not the orientation). */
const unrealCrosshair: BuilderPreset = {
  id: makeId(),
  engine: 'Unreal',
  category: 'indicator',
  name: 'Crosshair',
  width: 32,
  height: 32,
  layers: [
    lineLayer({ id: 'h', name: 'Horizontal', x: 4, y: 14, width: 24, height: 4, stroke: { color: '#FFFFFF', width: 2 } }),
    rectLayer({ id: 'v', name: 'Vertical', x: 14, y: 4, width: 4, height: 24, fill: '#FFFFFF' }),
  ],
};

/** Common presets (engine-neutral). */
const commonButton: BuilderPreset = {
  id: makeId(),
  engine: 'Common',
  category: 'button',
  name: 'Button',
  width: 160,
  height: 48,
  layers: [
    rectLayer({ id: 'bg', name: 'Background', x: 0, y: 0, width: 160, height: 48, fill: '#4A5568' }),
    rectLayer({ id: 'border', name: 'Border', x: 0, y: 0, width: 160, height: 48, fill: '#2D3748', stroke: { color: '#718096', width: 2 } }),
    textLayer({ id: 'label', name: 'Label', x: 0, y: 12, width: 160, height: 24, content: 'Button', fill: '#FFFFFF', text: { content: 'Button', fontSize: 16, fontFamily: 'system-ui, sans-serif', align: 'center' } }),
  ],
};

const commonPanel: BuilderPreset = {
  id: makeId(),
  engine: 'Common',
  category: 'panel',
  name: 'Panel',
  width: 320,
  height: 200,
  layers: [
    rectLayer({ id: 'bg', name: 'Background', x: 0, y: 0, width: 320, height: 200, fill: '#2D3748' }),
  ],
};

const commonTitleText: BuilderPreset = {
  id: makeId(),
  engine: 'Common',
  category: 'text',
  name: 'Title Text',
  width: 240,
  height: 36,
  layers: [
    textLayer({ id: 't', name: 'Title', x: 0, y: 0, width: 240, height: 36, content: 'Heading', fill: '#FFFFFF', text: { content: 'Heading', fontSize: 28, fontFamily: 'system-ui, sans-serif', align: 'left' } }),
  ],
};

const commonDivider: BuilderPreset = {
  id: makeId(),
  engine: 'Common',
  category: 'divider',
  name: 'Divider',
  width: 200,
  height: 2,
  layers: [
    lineLayer({ id: 'd', name: 'Divider', x: 0, y: 0, width: 200, height: 2, stroke: { color: '#718096', width: 1 } }),
  ],
};

export const PRESETS: BuilderPreset[] = [
  godotDialog,
  unityHealthBar,
  unrealCrosshair,
  commonButton,
  commonPanel,
  commonTitleText,
  commonDivider,
];
