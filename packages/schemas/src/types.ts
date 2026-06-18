// TypeScript types derived from the JSON schemas.
// Single source of truth — apps should import from @placeholderer/schemas
// rather than redefining these shapes locally.

export type AssetKind = 'image' | 'sprite_sheet' | 'tileset' | 'ui_panel' | 'audio';

export type Format = 'png' | 'jpg' | 'jpeg' | 'webp' | 'bmp' | 'gif' | 'wav';

export type NumberingStyle = 'zero-padded' | 'plain' | 'none';

export type LabelPosition = 'corners' | 'center' | 'top-center' | 'bottom-center';

export type FillMode = 'repeat' | 'stretch';

export type FrameStyle = 'simple' | 'beveled' | 'inset' | 'outlined';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten';

export type LayerType =
  | 'rect'
  | 'circle'
  | 'line'
  | 'text'
  | 'raster'
  | 'filled-shape';

export type PatternKind = 'checkerboard' | 'stripes' | 'diagonal';

export interface JobDefaults {
  label_enabled?: boolean;
  numbering_style?: NumberingStyle;
  background_color?: string;
  fill_mode?: FillMode;
}

export interface JobMeta {
  name?: string;
  defaults?: JobDefaults;
}

/** Fields shared by every asset kind. Image-style assets also need
 *  width/height; audio does not. */
export interface BaseAsset {
  kind: AssetKind;
  name: string;
  width?: number;
  height?: number;
  format: Format;
  output_path: string;
  label_enabled?: boolean;
  numbering_style?: NumberingStyle;
  label_position?: LabelPosition;
  background_color?: string;
  fill_mode?: FillMode;
  custom_fill_image?: string;
}

/** BaseAsset plus the image dimensions, which every image-style
 *  asset (image, sprite_sheet, tileset, ui_panel) requires. */
export interface DimensionalAsset extends BaseAsset {
  width: number;
  height: number;
}

export interface ImageAsset extends DimensionalAsset {
  kind: 'image';
}

export interface SpriteSheetAsset extends DimensionalAsset {
  kind: 'sprite_sheet';
  frame_width: number;
  frame_height: number;
  rows: number;
  columns: number;
  show_grid?: boolean;
  /** Per-frame duration in milliseconds. When set, the generator
   *  writes an animation.json sidecar with the timing data. */
  frame_duration_ms?: number;
}

export interface TilesetAsset extends DimensionalAsset {
  kind: 'tileset';
  tile_width: number;
  tile_height: number;
}

export interface UiPanelAsset extends DimensionalAsset {
  kind: 'ui_panel';
  frame_style?: FrameStyle;
  panel_guides?: boolean;
  export_panel_metadata?: boolean;
}

export interface AudioAsset extends BaseAsset {
  kind: 'audio';
  /** Tone frequency in Hz. */
  frequency: number;
  /** Duration in seconds. */
  duration: number;
  /** Sample rate in Hz. Defaults to 44100. */
  sample_rate?: number;
  /** Peak amplitude 0..1. Defaults to 0.5. */
  amplitude?: number;
}

export type Asset = ImageAsset | SpriteSheetAsset | TilesetAsset | UiPanelAsset | AudioAsset;

export interface Request {
  name?: string;
  folders?: string[];
  assets: Asset[];
}

export interface Manifest {
  schemaVersion: 1;
  job?: JobMeta;
  requests: Request[];
}

// ----- Builder recipe -----

export type FillSpec =
  | string
  | { type: 'image'; src: string; mode: FillMode }
  | { type: 'pattern'; pattern: PatternKind };

export interface StrokeSpec {
  color?: string;
  width?: number;
}

export interface ShadowEffect {
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  color?: string;
  opacity?: number;
}

export interface GlowEffect {
  blur?: number;
  color?: string;
  opacity?: number;
}

export interface LayerEffects {
  shadow?: ShadowEffect;
  glow?: GlowEffect;
}

export interface TextSpec {
  content?: string;
  fontSize?: number;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
}

interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity?: number;
  blendMode?: BlendMode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  fill?: FillSpec;
  stroke?: StrokeSpec;
  effects?: LayerEffects;
}

export interface RectLayer extends LayerBase {
  type: 'rect';
}

export interface CircleLayer extends LayerBase {
  type: 'circle';
}

export interface LineLayer extends LayerBase {
  type: 'line';
}

export interface TextLayer extends LayerBase {
  type: 'text';
  text?: TextSpec;
}

export interface RasterLayer extends LayerBase {
  type: 'raster';
  rasterSrc?: string;
}

export interface FilledShapeLayer extends LayerBase {
  type: 'filled-shape';
}

export type Layer =
  | RectLayer
  | CircleLayer
  | LineLayer
  | TextLayer
  | RasterLayer
  | FilledShapeLayer;

export type CanvasMode = 'compact' | 'large';

export interface BuilderRecipe {
  canvasMode: CanvasMode;
  width?: number;
  height?: number;
  gridSize?: number;
  snapEnabled?: boolean;
  layers: Layer[];
  history?: unknown[];
}

/** Allowable safe adjustments a user can make on an asset without rewriting its identity. */
export interface SafeAdjustment {
  label_enabled?: boolean;
  numbering_style?: NumberingStyle;
  label_position?: LabelPosition;
  panel_guides?: boolean;
}
