// Per-engine starter content used by both the web Templates page and
// the CLI's `init-template` command. Each engine knows its preferred
// folder root, naming convention, sizing notes, and how to render a
// starter manifest body for each asset type.

export type TemplateType = 'image' | 'sprite_sheet' | 'ui_panel' | 'tileset' | 'mixed';

export interface EngineGuide {
  engine: string;
  v11?: boolean;
  /** Root folder for assets, e.g. "res://art/" for Godot, "Assets/Art/" for Unity. */
  defaultPath: string;
  /** One-line naming guidance shown to the user. */
  namingConvention: string;
  /** One-line sizing guidance. */
  sizingNotes: string;
}

export const ENGINE_GUIDES: EngineGuide[] = [
  {
    engine: 'Godot',
    defaultPath: 'res://art/',
    namingConvention: 'snake_case; group by feature, not by type',
    sizingNotes: 'Tiles 16/32/64; UI at @1x/@2x/@3x of 1px base',
  },
  {
    engine: 'Unity',
    defaultPath: 'Assets/Art/',
    namingConvention: 'PascalCase; sprite + UI atlas as one asset where possible',
    sizingNotes: 'Set Pixels Per Unit; pick a reference resolution for the Canvas',
  },
  {
    engine: 'RPG Maker',
    defaultPath: 'img/',
    namingConvention: 'Lowercase with optional _suffix for variants',
    sizingNotes: 'Characters 48x48 (MV/MZ); tilesets 16x16 or 24x24',
  },
  {
    engine: 'GameMaker',
    defaultPath: 'sprites/',
    namingConvention: 'snake_case; keep names short to fit the IDE',
    sizingNotes: 'Power-of-2 sizes; origin top-left by default',
  },
  {
    engine: 'Unreal',
    defaultPath: 'Content/Art/',
    namingConvention: 'Prefix by type: T_ for textures, M_ for materials, UI_ for UI',
    sizingNotes: 'Power-of-2 textures; UI designed at 1920x1080 reference',
  },
  {
    engine: 'GDevelop',
    v11: true,
    defaultPath: 'assets/',
    namingConvention: 'Lowercase with hyphens; one asset per file',
    sizingNotes: 'Most objects are 32x32; UI uses anchor points',
  },
  {
    engine: 'O3DE',
    v11: true,
    defaultPath: 'Assets/Textures/',
    namingConvention: 'PascalCase; group under feature folders',
    sizingNotes: 'Power-of-2; sRGB for color, linear for data textures',
  },
  {
    engine: 'Defold',
    v11: true,
    defaultPath: 'main/assets/',
    namingConvention: 'snake_case; assets are addressable by path',
    sizingNotes: 'Atlas-friendly; 1:1 pixel sizes work well',
  },
  {
    engine: 'Phaser',
    v11: true,
    defaultPath: 'public/assets/',
    namingConvention: 'Lowercase with hyphens or underscores',
    sizingNotes: 'Web-friendly; keep individual textures under 2048x2048',
  },
  {
    engine: 'PlayCanvas',
    v11: true,
    defaultPath: 'assets/',
    namingConvention: 'snake_case; one asset per file is preferred',
    sizingNotes: 'Power-of-2 preferred for mobile targets',
  },
];

export const TEMPLATE_TYPES: readonly TemplateType[] = [
  'image',
  'sprite_sheet',
  'ui_panel',
  'tileset',
  'mixed',
] as const;

export const V1_ENGINES = ENGINE_GUIDES.filter((g) => !g.v11).map((g) => g.engine);
export const V1_1_ENGINES = ENGINE_GUIDES.filter((g) => !!g.v11).map((g) => g.engine);
export const ALL_ENGINES = [...V1_ENGINES, ...V1_1_ENGINES];

export function getGuide(engine: string): EngineGuide | undefined {
  return ENGINE_GUIDES.find((g) => g.engine === engine);
}

export function isValidEngine(engine: string): boolean {
  return ENGINE_GUIDES.some((g) => g.engine === engine);
}

export function isValidType(type: string): type is TemplateType {
  return (TEMPLATE_TYPES as readonly string[]).includes(type);
}

interface BuildOpts {
  engine: string;
  type: TemplateType;
  guide: EngineGuide;
  jobName: string;
}

export function buildStarterManifest(opts: BuildOpts): unknown {
  const { engine, type, guide, jobName } = opts;
  const basePath = guide.defaultPath;

  const base: any = {
    schemaVersion: 1,
    job: {
      name: jobName,
      defaults: {
        background_color: '#2D3748',
      },
    },
    requests: [] as any[],
  };

  if (type === 'mixed') {
    base.requests = [{
      name: 'core_assets',
      folders: [`${basePath}ui/panels`, `${basePath}ui/icons`, `${basePath}sprites/enemies`],
      assets: [
        {
          kind: 'ui_panel',
          name: 'dialog_box_large',
          output_path: `${basePath}ui/panels`,
          width: 512,
          height: 128,
          format: 'png',
        },
        {
          kind: 'sprite_sheet',
          name: 'enemy_idle',
          output_path: `${basePath}sprites/enemies`,
          width: 256,
          height: 128,
          format: 'png',
          frame_width: 64,
          frame_height: 64,
          rows: 2,
          columns: 4,
        },
      ],
    }];
  } else {
    const asset: any = {
      kind: type,
      name: `${type}_example`,
      output_path: basePath,
      width: 256,
      height: 256,
      format: 'png',
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
