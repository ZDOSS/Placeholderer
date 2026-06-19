import { describe, it, expect } from 'vitest';
import { validateManifest, validateBuilderRecipe } from '../src/validation.js';

const validManifest = {
  schemaVersion: 1,
  requests: [
    {
      name: 'test',
      assets: [
        {
          kind: 'image',
          name: 'foo',
          width: 64,
          height: 64,
          format: 'png',
          output_path: 'art/foo',
        },
      ],
    },
  ],
};

describe('validateManifest', () => {
  it('accepts a well-formed manifest', () => {
    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects null', () => {
    const result = validateManifest(null);
    expect(result.valid).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(validateManifest('not an object').valid).toBe(false);
    expect(validateManifest(42).valid).toBe(false);
  });

  it('rejects missing requests array', () => {
    const result = validateManifest({ schemaVersion: 1 });
    expect(result.valid).toBe(false);
  });

  it('rejects wrong schemaVersion', () => {
    const result = validateManifest({ ...validManifest, schemaVersion: 2 });
    expect(result.valid).toBe(false);
  });

  it('rejects asset missing required fields', () => {
    const result = validateManifest({
      schemaVersion: 1,
      requests: [{ assets: [{ kind: 'image', name: 'foo' }] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects path traversal at the schema layer', () => {
    const result = validateManifest({
      ...validManifest,
      requests: [{
        ...validManifest.requests[0],
        assets: [{ ...validManifest.requests[0].assets[0], output_path: '../secrets' }],
      }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects leading-slash output_path at the schema layer', () => {
    const result = validateManifest({
      ...validManifest,
      requests: [{
        ...validManifest.requests[0],
        assets: [{ ...validManifest.requests[0].assets[0], output_path: '/abs' }],
      }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects bad width/height (zero or negative)', () => {
    const result = validateManifest({
      ...validManifest,
      requests: [{
        ...validManifest.requests[0],
        assets: [{ ...validManifest.requests[0].assets[0], width: 0 }],
      }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects unknown asset kind', () => {
    const result = validateManifest({
      ...validManifest,
      requests: [{
        ...validManifest.requests[0],
        assets: [{ ...validManifest.requests[0].assets[0], kind: 'weird_kind' }],
      }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects non-enum format', () => {
    const result = validateManifest({
      ...validManifest,
      requests: [{
        ...validManifest.requests[0],
        assets: [{ ...validManifest.requests[0].assets[0], format: 'tiff' }],
      }],
    });
    expect(result.valid).toBe(false);
  });

  it('accepts a phase-2 audio asset without width/height', () => {
    // Audio is dimensionless: width/height are image-only fields.
    // The old baseAsset required them and the head flow's
    // validateManifest rejected every audio manifest before
    // generation. A minimal valid audio asset should now pass.
    const result = validateManifest({
      schemaVersion: 1,
      job: { name: 'audio_test' },
      requests: [{
        name: 'sfx',
        assets: [{
          kind: 'audio',
          name: 'beep',
          format: 'wav',
          output_path: 'sfx',
          frequency: 440,
          duration: 0.25,
          sample_rate: 22050,
        }],
      }],
    });
    if (!result.valid) {
      // Surface the actual errors when the assertion fails.
      // eslint-disable-next-line no-console
      console.error('audio validation errors:', result.errors);
    }
    expect(result.valid).toBe(true);
  });

  it('accepts an image asset with width/height', () => {
    // Sanity check that the dimensional requirement still applies
    // to image-style assets after splitting the base.
    const result = validateManifest(validManifest);
    expect(result.valid).toBe(true);
  });

  it('rejects an image asset missing width or height', () => {
    const result = validateManifest({
      ...validManifest,
      requests: [{
        ...validManifest.requests[0],
        assets: [{ ...validManifest.requests[0].assets[0], width: undefined as any }],
      }],
    });
    expect(result.valid).toBe(false);
  });

  it('rejects an audio asset missing frequency or duration', () => {
    const result = validateManifest({
      schemaVersion: 1,
      requests: [{
        assets: [{
          kind: 'audio',
          name: 'beep',
          format: 'wav',
          output_path: 'sfx',
        }],
      }],
    });
    expect(result.valid).toBe(false);
  });

  it('accepts builder_recipe on image, tileset, and ui_panel assets', () => {
    // The schema should permit builder_recipe on every image-style
    // asset kind that generateJob can actually render through the
    // recipe layer stack.
    const recipe = {
      canvasMode: 'compact',
      layers: [
        { id: '1', type: 'rect', name: 'bg', visible: true, locked: false },
      ],
    };
    for (const kind of ['image', 'tileset', 'ui_panel'] as const) {
      const result = validateManifest({
        schemaVersion: 1,
        requests: [{
          assets: [{
            kind,
            name: `${kind}_with_recipe`,
            format: 'png',
            output_path: 'art',
            width: 32,
            height: 32,
            builder_recipe: recipe,
            ...(kind === 'tileset' ? { tile_width: 16, tile_height: 16 } : {}),
          }],
        }],
      });
      if (!result.valid) {
        // eslint-disable-next-line no-console
        console.error(`${kind} + builder_recipe validation errors:`, result.errors);
      }
      expect(result.valid).toBe(true);
    }
  });

  it('rejects builder_recipe on sprite_sheet assets', () => {
    // Regression for Greptile round 13: the schema previously
    // listed builder_recipe as a valid optional property of
    // spriteSheetAsset, but generateJob unconditionally rejects
    // this combination (the recipe renders one still image while
    // the animation sidecar would still claim rows × columns
    // frames, producing mismatched artifacts). The schema should
    // reject the combination at validation time so callers get
    // a clear schema error instead of a runtime asset error.
    const result = validateManifest({
      schemaVersion: 1,
      requests: [{
        assets: [{
          kind: 'sprite_sheet',
          name: 'sprites',
          format: 'png',
          output_path: 'art',
          width: 64,
          height: 64,
          frame_width: 16,
          frame_height: 16,
          rows: 2,
          columns: 2,
          builder_recipe: {
            canvasMode: 'compact',
            layers: [
              { id: '1', type: 'rect', name: 'bg', visible: true, locked: false },
            ],
          },
        }],
      }],
    });
    expect(result.valid).toBe(false);
    // The error must mention builder_recipe as an unknown property.
    const messages = result.errors
      .map((e) => `${e.path}: ${e.message} ${JSON.stringify(e.params ?? {})}`)
      .join('\n');
    expect(messages).toMatch(/builder_recipe/);
  });
});

describe('validateBuilderRecipe', () => {
  it('accepts a well-formed recipe', () => {
    const result = validateBuilderRecipe({
      canvasMode: 'compact',
      layers: [
        { id: '1', type: 'rect', name: 'bg', visible: true, locked: false },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('rejects bad canvasMode', () => {
    const result = validateBuilderRecipe({
      canvasMode: 'huge',
      layers: [],
    });
    expect(result.valid).toBe(false);
  });
});
