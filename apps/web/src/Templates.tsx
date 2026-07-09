import { useState } from 'react';
import { colors } from './colors';
import {
  V1_ENGINES,
  V1_1_ENGINES,
  TEMPLATE_TYPES,
  getGuide,
  buildStarterManifest,
  type TemplateType,
} from '@placeholderer/core';

type AssetType = TemplateType;

function buildAiPrompt(engine: string, type: AssetType, exampleJson: string): string {
  return [
    `You are helping me author a Placeholderer v1 JSON manifest.`,
    `Target game engine: ${engine}.`,
    `Asset focus: ${type}.`,
    ``,
    `Rules:`,
    `- schemaVersion must be 1`,
    `- Output valid JSON only (no markdown fences)`,
    `- Use only safe path characters: letters, digits, _, -, ., /`,
    `- No ".." segments, no leading "/", no spaces in paths`,
    `- Each asset needs kind, name, format, output_path`,
    `- Image-style assets also need width and height (positive integers)`,
    `- sprite_sheet needs frame_width, frame_height, rows, columns`,
    `- tileset needs tile_width, tile_height`,
    `- audio needs frequency, duration, format "wav" (no width/height)`,
    `- Prefer the engine's default folder root when suggesting output_path`,
    ``,
    `Example starter for this engine/type:`,
    exampleJson,
    ``,
    `Generate a complete, ready-to-import manifest for my project.`,
  ].join('\n');
}

interface TemplatesProps {
  /** When true, show AI prompt copy helpers. */
  aiMode?: boolean;
}

export function Templates({ aiMode = false }: TemplatesProps) {
  const [selectedEngine, setSelectedEngine] = useState(V1_ENGINES[0]);
  const [selectedType, setSelectedType] = useState<AssetType>('mixed');
  const [copied, setCopied] = useState<'json' | 'prompt' | null>(null);

  const guide = getGuide(selectedEngine);
  const jobName = `${selectedEngine.toLowerCase()}_placeholders`;
  const manifest = buildStarterManifest({
    engine: selectedEngine,
    type: selectedType,
    guide: guide!,
    jobName,
  });
  const currentTemplate = JSON.stringify(manifest, null, 2);
  const aiPrompt = buildAiPrompt(selectedEngine, selectedType, currentTemplate);

  const copy = async (text: string, which: 'json' | 'prompt') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Templates</h2>
      <p style={{ color: colors.textMuted }}>
        Choose an engine, then select the asset type. Each engine produces
        starter content with its preferred folder root, naming convention,
        and sizing notes.
        {aiMode && (
          <span> AI-driven mode is on — copy a prompt for an external model, then paste the JSON back on Manifest.</span>
        )}
      </p>

      {/* Engine Selection — v1 first, then v1.1 */}
      <div style={{ margin: '1.5rem 0 1rem' }}>
        <div style={{ fontSize: '0.85rem', color: colors.textDim, marginBottom: '0.5rem' }}>Engine (v1)</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {V1_ENGINES.map(engine => (
            <button
              key={engine}
              onClick={() => setSelectedEngine(engine)}
              style={{
                padding: '0.5rem 1rem',
                background: selectedEngine === engine ? colors.accent : colors.bgInset,
                color: colors.text,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {engine}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.85rem', color: colors.textDim, margin: '0.75rem 0 0.5rem' }}>Engine (v1.1)</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {V1_1_ENGINES.map(engine => (
            <button
              key={engine}
              onClick={() => setSelectedEngine(engine)}
              style={{
                padding: '0.5rem 1rem',
                background: selectedEngine === engine ? colors.accent : colors.bgInset,
                color: colors.text,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              {engine}
            </button>
          ))}
        </div>
      </div>

      {/* Engine guidance */}
      {guide && (
        <div style={{
          margin: '1rem 0',
          padding: '0.75rem 1rem',
          background: colors.bgElevated,
          border: `1px solid ${colors.border}`,
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: colors.textMuted,
        }}>
          <div><strong>Default path:</strong> <code style={{ color: colors.accent }}>{guide.defaultPath}</code></div>
          <div><strong>Naming:</strong> {guide.namingConvention}</div>
          <div><strong>Sizing:</strong> {guide.sizingNotes}</div>
        </div>
      )}

      {/* Asset Type Selection */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.85rem', color: colors.textDim, marginBottom: '0.5rem' }}>Asset Type</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {TEMPLATE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                padding: '0.5rem 1rem',
                background: selectedType === type ? colors.accent : colors.bgInset,
                color: colors.text,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {type === 'mixed' ? 'Bundled / Mixed' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Template Output */}
      <pre style={{
        background: colors.bgInset,
        color: colors.text,
        padding: '1.5rem',
        borderRadius: '8px',
        fontSize: '0.85rem',
        border: `1px solid ${colors.border}`,
        overflow: 'auto',
        maxHeight: '420px'
      }}>
        {currentTemplate}
      </pre>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <button
          onClick={() => copy(currentTemplate, 'json')}
          style={{
            padding: '0.6rem 1.5rem',
            background: colors.accent,
            color: colors.text,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {copied === 'json' ? 'Copied JSON!' : 'Copy JSON'}
        </button>
        {aiMode && (
          <button
            onClick={() => copy(aiPrompt, 'prompt')}
            style={{
              padding: '0.6rem 1.5rem',
              background: colors.bgInset,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {copied === 'prompt' ? 'Copied prompt!' : 'Copy AI prompt'}
          </button>
        )}
      </div>
    </div>
  );
}
