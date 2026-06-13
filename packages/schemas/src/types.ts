// Shared TypeScript types derived from the JSON schemas.
// These will be expanded as the schemas stabilize.

export type AssetKind = 'image' | 'sprite_sheet' | 'tileset' | 'ui_panel';

export interface JobDefaults {
  label_enabled?: boolean;
  numbering_style?: 'zero-padded' | 'plain' | 'none';
  background_color?: string;
  fill_mode?: 'repeat' | 'stretch';
}

export interface BaseAsset {
  kind: AssetKind;
  name: string;
  width: number;
  height: number;
  format: string;
  output_path: string;
  label_enabled?: boolean;
  numbering_style?: string;
  label_position?: 'corners' | 'center' | 'top-center' | 'bottom-center';
  background_color?: string;
  fill_mode?: 'repeat' | 'stretch';
  custom_fill_image?: string;
}