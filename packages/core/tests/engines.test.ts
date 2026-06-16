import { describe, it, expect } from 'vitest';
import {
  ENGINE_GUIDES,
  V1_ENGINES,
  V1_1_ENGINES,
  ALL_ENGINES,
  TEMPLATE_TYPES,
  isValidEngine,
  isValidType,
  getGuide,
  buildStarterManifest,
} from '../src/engines.js';

describe('engine catalog', () => {
  it('exposes the spec v1 engines', () => {
    expect(V1_ENGINES).toEqual(['Godot', 'Unity', 'RPG Maker', 'GameMaker', 'Unreal']);
  });

  it('exposes the spec v1.1 engines', () => {
    expect(V1_1_ENGINES).toEqual(['GDevelop', 'O3DE', 'Defold', 'Phaser', 'PlayCanvas']);
  });

  it('every catalog entry has a guide', () => {
    for (const engine of ALL_ENGINES) {
      const guide = getGuide(engine);
      expect(guide).toBeDefined();
      expect(guide!.defaultPath).toBeTruthy();
      expect(guide!.namingConvention).toBeTruthy();
      expect(guide!.sizingNotes).toBeTruthy();
    }
  });

  it('isValidEngine / isValidType are strict', () => {
    expect(isValidEngine('Godot')).toBe(true);
    expect(isValidEngine('NotAnEngine')).toBe(false);
    expect(isValidType('image')).toBe(true);
    expect(isValidType('not-a-type')).toBe(false);
  });
});

describe('buildStarterManifest', () => {
  it('Godot mixed uses art/ paths (the res:// prefix lives in the guide text, not the manifest)', () => {
    const guide = getGuide('Godot')!;
    const manifest = buildStarterManifest({
      engine: 'Godot',
      type: 'mixed',
      guide,
      jobName: 'godot_pack',
    }) as any;
    expect(manifest.job.name).toBe('godot_pack');
    expect(manifest.requests[0].folders).toContain('art/ui/panels');
    expect(manifest.requests[0].assets.some((a: any) => a.output_path === 'art/ui/panels')).toBe(true);
    expect(guide.sizingNotes).toContain('res://');
  });

  it('Unity sprite_sheet uses Assets/Art/', () => {
    const guide = getGuide('Unity')!;
    const manifest = buildStarterManifest({
      engine: 'Unity',
      type: 'sprite_sheet',
      guide,
      jobName: 'unity_pack',
    }) as any;
    expect(manifest.requests[0].assets[0].output_path).toBe('Assets/Art/');
    expect(manifest.requests[0].assets[0].kind).toBe('sprite_sheet');
    expect(manifest.requests[0].assets[0].rows).toBe(2);
    expect(manifest.requests[0].assets[0].columns).toBe(4);
  });

  it('Unreal tileset uses Content/Art/', () => {
    const guide = getGuide('Unreal')!;
    const manifest = buildStarterManifest({
      engine: 'Unreal',
      type: 'tileset',
      guide,
      jobName: 'unreal_pack',
    }) as any;
    expect(manifest.requests[0].assets[0].output_path).toBe('Content/Art/');
    expect(manifest.requests[0].assets[0].kind).toBe('tileset');
  });

  it('v1.1 engines produce their own path conventions', () => {
    const defoldGuide = getGuide('Defold')!;
    const defold = buildStarterManifest({
      engine: 'Defold', type: 'image', guide: defoldGuide, jobName: 'defold'
    }) as any;
    expect(defold.requests[0].assets[0].output_path).toBe('main/assets/');
  });
});
