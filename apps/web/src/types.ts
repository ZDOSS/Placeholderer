export interface Asset {
  kind: 'image' | 'sprite_sheet' | 'tileset' | 'ui_panel';
  name: string;
  width: number;
  height: number;
  format: string;
  output_path: string;
  label_enabled?: boolean;
  numbering_style?: string;
  label_position?: string;
  background_color?: string;
  fill_mode?: string;
  frame_width?: number;
  frame_height?: number;
  rows?: number;
  columns?: number;
  tile_width?: number;
  tile_height?: number;
  frame_style?: string;
  panel_guides?: boolean;
  export_panel_metadata?: boolean;
}

export interface Request {
  name?: string;
  folders?: string[];
  assets: Asset[];
}

export interface Job {
  schemaVersion: number;
  job?: {
    name?: string;
    defaults?: any;
  };
  requests: Request[];
}

export interface SafeAdjustment {
  label_enabled?: boolean;
  numbering_style?: 'zero-padded' | 'plain' | 'none';
  label_position?: 'corners' | 'center' | 'top-center' | 'bottom-center';
  panel_guides?: boolean;
}