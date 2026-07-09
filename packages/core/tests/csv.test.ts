import { describe, it, expect } from 'vitest';
import { parseCsvLine, parseCsvToManifest } from '../src/csv.js';
import { validateManifest } from '../src/validation.js';

describe('parseCsvLine', () => {
  it('splits simple rows', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('honors quoted commas', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('honors escaped quotes', () => {
    expect(parseCsvLine('"say ""hi""",x')).toEqual(['say "hi"', 'x']);
  });
});

describe('parseCsvToManifest', () => {
  it('builds a valid image manifest', () => {
    const csv = [
      'name,width,height,format,output_path',
      'hero,64,64,png,art/heroes',
    ].join('\n');
    const result = parseCsvToManifest(csv, 'image');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const v = validateManifest(result.manifest);
    expect(v.valid).toBe(true);
    expect(result.manifest.requests[0].assets[0].kind).toBe('image');
  });

  it('rejects empty input', () => {
    expect(parseCsvToManifest('', 'image').ok).toBe(false);
  });

  it('rejects kind column mismatch', () => {
    const csv = 'name,kind,width,height,format,output_path\nx,tileset,32,32,png,art';
    const result = parseCsvToManifest(csv, 'image');
    expect(result.ok).toBe(false);
  });

  it('coerces booleans and numbers', () => {
    const csv = [
      'name,width,height,format,output_path,frame_width,frame_height,rows,columns,show_grid',
      'sheet,128,64,png,art,64,64,1,2,false',
    ].join('\n');
    const result = parseCsvToManifest(csv, 'sprite_sheet');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const asset = result.manifest.requests[0].assets[0] as any;
    expect(asset.show_grid).toBe(false);
    expect(asset.frame_width).toBe(64);
    expect(validateManifest(result.manifest).valid).toBe(true);
  });
});
