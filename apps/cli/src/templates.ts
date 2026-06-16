// Engine template metadata. Used by `list-templates` and
// `init-template` so the two commands stay in sync about what's
// available. Real per-engine starter content (folder structures,
// naming hints, sizing) lands in a later commit; this file is the
// engine/type catalog and the v1 starter body that the GUI Templates
// page also uses.

export type TemplateType = 'image' | 'sprite_sheet' | 'ui_panel' | 'tileset' | 'mixed';

export interface EngineTemplate {
  engine: string;
  type: TemplateType;
  /** Spec for the v1.1 engines. */
  v11?: boolean;
}

/** v1 spec engines. */
export const V1_ENGINES = [
  'Godot',
  'Unity',
  'RPG Maker',
  'GameMaker',
  'Unreal',
] as const;

/** v1.1 spec engines. */
export const V1_1_ENGINES = [
  'GDevelop',
  'O3DE',
  'Defold',
  'Phaser',
  'PlayCanvas',
] as const;

export const ALL_ENGINES = [...V1_ENGINES, ...V1_1_ENGINES] as const;

export const TEMPLATE_TYPES: readonly TemplateType[] = [
  'image',
  'sprite_sheet',
  'ui_panel',
  'tileset',
  'mixed',
] as const;

export function isValidEngine(engine: string): boolean {
  return (ALL_ENGINES as readonly string[]).includes(engine);
}

export function isValidType(type: string): type is TemplateType {
  return (TEMPLATE_TYPES as readonly string[]).includes(type);
}

/**
 * Render a starter manifest body for the given engine and type.
 *
 * v1: every engine produces the same shape; engine only affects job.name.
 * Real per-engine folder structures / naming / sizing land with the
 * engine templates work in a later commit.
 */
export function renderStarterManifest(engine: string, type: TemplateType): unknown {
  const base: any = {
    schemaVersion: 1,
    job: { name: `${engine.toLowerCase()}_placeholders` },
    requests: [] as any[],
  };

  if (type === 'mixed') {
    base.requests = [{
      name: 'core_assets',
      assets: [
        { kind: 'ui_panel', name: 'dialog', width: 480, height: 240, format: 'png', output_path: 'assets/ui' },
        { kind: 'sprite_sheet', name: 'enemy_idle', width: 256, height: 128, format: 'png', output_path: 'assets/sprites', frame_width: 64, frame_height: 64, rows: 2, columns: 4 },
      ],
    }];
  } else {
    const asset: any = {
      kind: type,
      name: `${type}_example`,
      width: 256,
      height: 256,
      format: 'png',
      output_path: 'assets',
    };
    if (type === 'sprite_sheet') {
      asset.frame_width = 64;
      asset.frame_height = 64;
      asset.rows = 2;
      asset.columns = 4;
    }
    if (type === 'tileset') {
      asset.tile_width = 32;
      asset.tile_height = 32;
    }
    if (type === 'ui_panel') {
      asset.panel_guides = true;
    }
    base.requests = [{ name: 'assets', assets: [asset] }];
  }

  return base;
}
