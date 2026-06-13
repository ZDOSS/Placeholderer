# Placeholderer v1 Product and Technical Spec

## Overview

Placeholderer is a free, open-source placeholder asset generator aimed primarily at game developers, with strong support for UI placeholder workflows and related app/game crossover needs. The primary experience is a browser-first application that feels complete on its own, while a CLI offers parity for automation, scripting, and AI-assisted usage.

The product accepts structured CSV or JSON input, generates placeholder assets and optional folder hierarchy, and returns a downloadable ZIP package. It also includes a lightweight UI Builder for creating placeholder-grade interface elements such as panels, buttons, frames, bars, and text-based mock UI.

## Product goals

- Generate placeholder art assets quickly from structured manifests.
- Support game-development-first workflows, especially sprite sheets, tilesets, UI panels, and generic placeholder images.
- Allow users to create folder hierarchy and files together in one job.
- Deliver a browser experience that is complete enough for most users.
- Provide a CLI with broad feature parity for automation and AI workflows.
- Stay local-first and mostly stateless, with only lightweight browser persistence.
- Support AI-assisted authoring with templates, prompts, and strict schemas.
- Include a lightweight UI Builder for placeholder UI elements.

## Non-goals

- Placeholderer is not a cloud workspace.
- Placeholderer is not an art hosting or archival platform.
- Placeholderer is not an Airtable/Excel-style data editor.
- Placeholderer is not a production art suite or Figma replacement.
- Placeholderer is not a full video editor in v1.

## Primary users

- Solo and small-team game developers.
- Developers setting up placeholder folder structures and stand-in art.
- UI-heavy game developers who need placeholder windows, buttons, panels, and frames.
- Technical users who want an AI system to draft manifests.
- Developers who want a CLI for scripted or agent-driven usage.

## Product principles

- Browser-first and tool-like.
- Minimal persistence; users should be able to import, generate, download, and leave.
- Strict validation over permissive guessing.
- One-asset-at-a-time focused preview where appropriate.
- JSON is the preferred serious format; CSV remains a simpler path.
- AI features are optional, not mandatory.
- The UI Builder should be powerful enough for believable mock UI, but not drift into a full design application.

## Core concepts

### Job

A job is the full imported workload. It can contain requests, optional folder declarations, and many assets.

### Request

A request is a logical grouping inside a job. A request may contain mixed asset kinds and should be displayed as one block in the Job Overview. JSON Schema is well suited to validating array-based object structures like repeated requests and nested assets.[cite:76][cite:88]

### Asset

An asset is one generated output definition. Core identity fields such as `name`, `kind`, `format`, and path-related values remain manifest-owned.

### Job defaults

A mixed-job JSON manifest may include limited job-level defaults. Defaults reduce repetition, but asset-level values override them, and core identity fields remain explicit per asset.

### Builder recipe

A builder recipe is a separate schema used by the UI Builder. It stores builder-specific editing data such as layers, grid settings, snap mode, imported raster elements, text settings, and export options.

A main manifest may reference builder recipes in either of two ways:
- embedded object
- external file reference

Both forms should be supported and normalized internally into one builder-recipe structure.

## Main modes

### Manual mode

Manual mode is the default app experience and focuses on import, review, safe adjustments, generation, and download.

### AI-driven mode

AI-driven mode exposes prompt-copy actions, JSON-first templates, and AI-oriented helper copy for users who want an external AI to draft manifests. Browser clipboard APIs support this kind of one-click text copying from explicit user interactions.[cite:74][cite:77]

The AI-driven mode toggle should be saved as a lightweight browser preference rather than as part of a long-term project model. The browser `localStorage` API persists data across sessions for the same origin, making it suitable for small UI preferences.[cite:106][cite:251]

## Main application views

## Home / Import

Purpose:
- Start a new job.
- Let the user upload CSV or JSON.
- Let the user paste JSON directly.
- Let CSV users select their asset type before parsing.
- Surface the AI-driven mode toggle.

Main elements:
- File picker.
- Drag-and-drop import on appropriate screens.
- Paste JSON textarea.
- CSV asset-type selector.
- Sample manifest actions.
- AI-driven mode toggle.

## Templates

Purpose:
- Help users and AI systems create valid inputs.
- Keep schema learning short and practical.

Main elements:
- Asset type dropdown.
- Engine template selector.
- Example JSON templates.
- Example CSV templates.
- Copy prompt buttons.
- Short schema notes.

Template categories should include:
- `image`
- `sprite_sheet`
- `tileset`
- `ui_panel`
- `mixed_job`
- engine-specific variants where applicable

## Job Overview

Purpose:
- Act as the main session hub.
- Show one block per imported request.
- Let users drill into a request to inspect contained assets.

Behavior:
- Each request appears as a collapsible block.
- Clicking a request reveals child asset blocks in an explorer-like layout.
- Text summaries and counts are required.
- Small preview strips showing 2–3 representative outputs per request block should be included.

Suggested request block contents:
- Request name or generated label.
- Asset count.
- Asset kinds present.
- Output folders affected.
- Validation warnings/errors count.
- Small preview strip.

## Item Detail

Purpose:
- Configure and preview a single asset.
- Allow safe changes without turning the app into a spreadsheet editor.

Allowed safe changes:
- Label text.
- Numbering style.
- Optional panel guide visibility in preview.
- Optional metadata export toggle.
- Other small non-identity adjustments.

Not allowed:
- Broad freeform manifest editing.
- Arbitrary path rewriting.
- Spreadsheet-style row editing.

## Generate

Purpose:
- Process the full job and package the result.

Main elements:
- Progress bar.
- Current request/asset label.
- Completed/failed counters.
- Error summary.
- Cancel action.

Behavior:
- Generation should immediately lead into download on success so users do not accidentally download stale prior outputs.

## Results

Purpose:
- Show what was produced.
- Let users review and rerun after small changes.

Outputs:
- ZIP download result.
- Manifest report.
- Validation report.
- Failure/error report.
- Regenerate action.

## UI Builder

The UI Builder is a first-class section inside the main app, not a separate product. It is intended for placeholder-grade UI creation, not polished production UI design.

### Builder goals

- Let users create placeholder panels, buttons, bars, frames, windows, tabs, text labels, and related UI elements.
- Support presets plus start-from-scratch creation.
- Support image-backed and pattern-backed placeholder creation.
- Export usable placeholder images and editable recipe data.

### Builder workspace modes

The builder should provide two workspace modes:
- Compact mode for buttons, small windows, bars, tabs, frames, and similar UI elements.
- Large mode for broader desktop-style UI composition.

Large mode should use a responsive workspace that defaults to a 1920x1080-oriented editing ratio instead of pretending to be literal fullscreen.

### Builder features

Required v1 features:
- Background grid.
- Configurable grid size.
- Snap toggle tied to the current grid.
- Basic shapes.
- Text elements.
- Raster image import.
- Imported raster images usable as placed elements.
- Imported raster images usable as repeat/tile fills.
- Presets per UI element category.
- Start-from-scratch path.
- Flat layer stack.
- Layer visibility toggle.
- Layer lock toggle.
- Layer rename.
- Layer reorder.
- Duplicate/delete actions.
- Opacity control.
- Curated blend mode list.
- Basic effects such as outlines and shadows.
- Scale, rotate, and flip transforms.
- Undo/redo with a bounded history of about 5 steps.
- Export image files.
- Export guide/metadata when applicable.
- Export editable builder recipe JSON.
- Import existing builder recipe JSON to continue editing.

### Builder layers

The builder should use a flat Photoshop-style layer stack. Each element sits in an ordered stack so that overlap and draw order remain understandable. UI and canvas systems commonly rely on hierarchy or z-order to control which elements appear in front of others, making an ordered layer stack an appropriate model here.[cite:218][cite:221][cite:222]

Layer folders/groups are explicitly out of scope for v1.

### Builder effects and compositing

Simple compositing and effects should be included in v1. The Canvas 2D API supports compositing modes through `globalCompositeOperation`, shadow treatments through properties such as `shadowBlur`, and repeated pattern fills through `createPattern()`, which makes blend modes, simple effects, and repeat-based fills realistic features for this tool.[cite:231][cite:242][cite:243]

The curated v1 blend mode list should stay small and practical.

### Builder input formats

Builder imports should support raster inputs in v1. In this context, raster includes formats such as PNG, JPG/JPEG, GIF, and BMP rather than SVG.[cite:223][cite:4]

### Builder export formats

Builder exports should support the following targets in v1:
- PNG
- JPG / JPEG
- SVG
- BMP
- GIF

SVG should be supported because it is a vector format intended to scale cleanly across resolutions and is especially valuable for shape-driven UI and scalable interface graphics.[cite:193][cite:194][cite:192]

Canvas-based browser export paths are strong for PNG and JPEG, while SVG output can be serialized directly as SVG text or blobs for download workflows.[cite:176][cite:183][cite:200]

Browser-side approaches also exist for BMP export from canvas and GIF encoding in JavaScript, which makes those formats valid targets rather than theoretical future work.[cite:203][cite:216][cite:208][cite:214]

### Builder persistence

The builder should use browser-side saving for routine usage, with clear messaging that saved state can be lost if browser storage or cache is cleared. `localStorage` persists across sessions for the same origin, but it is not a durable archival guarantee because users or browser cleanup can remove stored data.[cite:106][cite:251][cite:259]

### Builder fonts

The builder should support both:
- system fonts by default for reliability and offline friendliness
- bundled open-source fonts as optional style choices

Offline-hosted fonts are a standard option when custom fonts are needed without relying on network access.[cite:182][cite:201][cite:188]

## User flows

### Manual manifest flow

1. User opens Placeholderer.
2. User uploads CSV or JSON, or pastes JSON.
3. If CSV is chosen, the user selects the asset type before parsing.
4. The app parses the job and opens Job Overview.
5. The user expands a request block.
6. The user selects an asset.
7. Item Detail opens.
8. The user makes safe adjustments and confirms.
9. Job Overview updates.
10. The user clicks Generate and Download.
11. The app builds the ZIP, downloads it, and remains on a useful results/generation screen for reruns.

### AI-assisted flow

1. User enables AI-driven mode.
2. User opens Templates.
3. User chooses a type or engine template.
4. User copies the matching prompt.
5. User asks an external AI to generate a JSON manifest.
6. User pastes the JSON into Placeholderer.
7. User reviews, previews, generates, and downloads.

### UI Builder flow

1. User opens the UI Builder tab/section.
2. User chooses a preset or starts from scratch.
3. User chooses compact or large workspace mode.
4. User edits shapes, text, imported raster elements, fills, layers, and effects.
5. User previews and adjusts output.
6. User exports image files and optionally builder recipe JSON.
7. User may later re-import builder recipe JSON to continue editing.

## Manifest model

## JSON

JSON is the preferred format for real jobs. It supports mixed asset kinds, request grouping, folder declarations, builder-recipe references, and lightweight defaults.

Suggested top-level shape:

```json
{
  "schemaVersion": 1,
  "job": {
    "name": "forest_ui_placeholder_pack",
    "defaults": {
      "label_enabled": true,
      "numbering_style": "zero-padded"
    }
  },
  "requests": [
    {
      "name": "core_folders_and_ui",
      "folders": [
        "art/ui/panels",
        "art/ui/icons",
        "art/sprites/enemies"
      ],
      "assets": [
        {
          "kind": "ui_panel",
          "name": "dialog_box_large",
          "output_path": "art/ui/panels",
          "width": 512,
          "height": 128,
          "format": "png",
          "panel_guides": true,
          "export_panel_metadata": false,
          "builder_recipe": {
            "canvasMode": "compact",
            "layers": []
          }
        },
        {
          "kind": "sprite_sheet",
          "name": "slime_idle",
          "output_path": "art/sprites/enemies",
          "frame_width": 64,
          "frame_height": 64,
          "rows": 2,
          "columns": 4,
          "format": "png",
          "label_mode": "numbered"
        }
      ]
    }
  ]
}
```

Rules:
- `requests` is required.
- Each request can contain mixed `kind` values.
- Each asset carries its own `format`.
- Job-level defaults are optional and limited.
- Asset-level values override job defaults.
- Empty folders declared by the job should be created in the ZIP even if no generated asset lands inside them.
- Builder recipes may appear as embedded objects or file references.

## CSV

CSV should support every generation type, but only one type per import. The user must choose that type before upload so validation can be strict from the start.

CSV should remain flat and simple:
- One row per asset.
- No mixed asset kinds in one CSV import.
- No advanced request grouping beyond what can be treated as a single request.

## Supported asset types for v1

### Image

Standard placeholder image with width, height, format, label, color/pattern, and output path.

### Sprite sheet

A frame grid with optional numbering and optional labels.

### Tileset

Should support both repeated patterns and labeled/indexed tile cells.

### UI panel

Should generate clean panel images for direct use in UI work. Preview may show guides, while output defaults to clean images plus optional metadata export.

Nine-slice scaling is a common UI technique in which an image is divided into nine regions so corners stay intact while the center and edges scale appropriately.[cite:72][cite:69][cite:75]

## Placeholder Rendering Rules

This section defines how placeholder assets are visually generated in v1.

### Background & Fill
- Every generated asset has a background.
- Default: a muted neutral gray (`#4A5568`).
- Users can override with a custom color via `background_color`.
- Users can also supply a custom raster image to be used as a repeating/tiled fill or stretched fill.

### Fill Modes (when using a custom image)
- `repeat`: The image is tiled across the asset using `createPattern()`.
- `stretch`: The image is scaled to exactly fill the asset dimensions.

### Text / Labels
- By default, the asset name (or numbered label) appears in **each of the four corners**.
- Users can choose alternative placements: center, top-center, bottom-center, or disable labels entirely.
- Font size is proportional (roughly 60-70% of the smaller dimension).
- Text is rendered white with a subtle dark outline for readability on any background.
- Long names are truncated.

### Sprite Sheets & Tilesets
- Grid lines between frames are shown **by default**.
- Users can toggle grid visibility per asset.
- Numbering follows the chosen `numbering_style` and can be placed in corners or center.

### UI Panels
- v1 supports multiple frame styles (at least 3–4 variations).
- Preview can optionally show construction guides.
- Final export is clean (no guides) unless `export_panel_metadata` is enabled.

### General Rules
- All rendering happens client-side using Canvas (browser) or equivalent in CLI.
- Labels, guides, and fills respect the `label_enabled` and guide flags from the manifest.

## Engine-aware templates

Engine-aware templates should be first-class product features.

### v1 engine templates

- Godot
- Unity
- RPG Maker
- GameMaker
- Unreal

### v1.1 engine templates

- GDevelop
- O3DE
- Defold
- Phaser
- PlayCanvas

Where engine guidance exists, templates should include as much applicable information as possible:
- folder structure
- naming suggestions
- starter manifests
- common art or UI sizing hints

There is enough source material to justify engine-aware templates, especially for Godot resolution handling and UI scaling, Unity naming guidance for UI contexts, and Unreal’s emphasis on consistent asset naming conventions.[cite:161][cite:175][cite:173]

## Validation rules

Validation should be strict and predictable.

### Path and filename safety

Path and naming rules should be conservative. OWASP guidance recommends restricting allowed characters, limiting filename length, and not trusting provided filenames blindly.[cite:43][cite:83]

Recommended restrictions:
- Ban spaces.
- Allow only letters, numbers, hyphens, underscores, and forward slashes in paths.
- Reject `..`, absolute paths, repeated slashes, hidden dotfiles, trailing spaces, and suspicious extensions.
- Normalize paths before generation.
- Keep filenames manifest-owned except for safe overrides such as labels and numbering.

### Structural validation

- Required fields must exist.
- Numeric dimensions must be positive integers.
- Asset-specific fields must match the selected type.
- CSV imports must match the selected type schema.
- Duplicate generated paths should error or warn depending on overwrite rules.
- Builder-recipe references must resolve and validate if present.

## Output rules

- Generate one ZIP per whole job.
- ZIP name should derive from `job.name` using the same sanitization rules as files.
- Include declared empty folders.
- Include generated placeholder files.
- Include a manifest report describing created folders and files.
- Include an error report if any assets fail.

## Technical decisions

## Recommended stack

### Web app

- React
- TypeScript
- Vite
- `vite-plugin-pwa`
- Tailwind
- Radix Primitives only where useful for accessibility/interaction primitives

This is a strong fit for a structured browser tool and static hosting. Vite’s PWA plugin is built specifically for Vite-based apps and is commonly used to add PWA capabilities such as manifest/service worker setup to Vite projects.[cite:139][cite:142]

### CLI

- Node.js
- TypeScript

The CLI should support broad parity with the GUI except for deeply interactive builder-only workflows.

### Shared core

A shared TypeScript core package should contain:
- manifest schema definitions
- builder recipe schema definitions
- validation logic
- path normalization and sanitization
- asset generation logic
- report generation helpers
- template metadata

## Recommended libraries

| Area | Recommendation | Notes |
|---|---|---|
| JSON validation | AJV | Strong JSON Schema fit |
| CSV parsing | Papa Parse | Mature browser-friendly parsing |
| ZIP packaging | JSZip | Good browser-side packaging fit |
| State management | Zustand or simple reducer/context | Keep state manageable without overbuilding |
| UI primitives | Radix Primitives | Unstyled, accessibility-focused, MIT licensed.[cite:133][cite:134][cite:136] |
| Rendering | Canvas API / OffscreenCanvas | Good fit for browser-side generation |
| Testing | Vitest + Playwright | Unit plus end-to-end coverage |

Radix Primitives are a better fit than a heavy styled component library because they provide accessible building blocks without forcing a visual system, and they are MIT licensed, which aligns cleanly with an MIT open-source project.[cite:133][cite:138][cite:144]

Tailwind remains a reasonable modern utility-first styling approach, but it should be paired with early component extraction so JSX does not become overly noisy or repetitive.[cite:150][cite:158][cite:155]

## Project structure

```text
placeholderer/
  apps/
    web/
    cli/
  packages/
    core/
    schemas/
    templates/
```

Suggested responsibilities:
- `apps/web`: browser UI, PWA shell, builder UI.
- `apps/cli`: validation, generation, template commands.
- `packages/core`: parse, validate, sanitize, generate, report.
- `packages/schemas`: JSON Schema and CSV field specs.
- `packages/templates`: engine templates, prompt text, starter manifests.

## CLI feature direction

The CLI should support everything practical that the GUI does, excluding deeply interactive builder editing. Initial command set should include:
- `validate`
- `generate`
- `init-template`
- `list-templates`
- `explain-schema`

Builder-related commands may expand later as recipe and manifest integration matures.

## Browser persistence policy

Placeholderer should avoid acting like a saved workspace system.

Persist by default only:
- AI-driven mode on/off
- last selected template type
- lightweight builder/session state for routine use
- small UI preferences such as theme

Do not persist by default:
- generated outputs
- large historical job archives
- long-term project libraries

## Theming

The web app should support both light and dark themes in v1.

## Roadmap suggestion

### Phase 1

- Browser-first app with import/generate/download flow.
- Type-selected CSV import.
- JSON import with mixed requests.
- Request-based Job Overview.
- Item Detail with safe overrides.
- Image, sprite sheet, tileset, and UI panel generation.
- Engine templates for Godot, Unity, RPG Maker, GameMaker, and Unreal.
- Single ZIP output.
- Manifest and error reports.
- UI Builder with compact/large modes, layers, raster imports, fills, effects, recipe save/load, and major export targets.

### Phase 1.1

- Additional engine templates: GDevelop, O3DE, Defold, Phaser, PlayCanvas.
- More blend modes/effects if useful.
- Stronger manifest-ready builder export helpers.
- More presets and engine-aware UI templates.

### Phase 2

- Audio placeholder generation.
- Additional export presets.
- Experimental animated outputs and richer media workflows.
- Potential deeper engine-specific export helpers.

## Final recommendation

The strongest implementation path is a browser-first PWA deployed as a static site, backed by a shared TypeScript core reused by both the web app and CLI. Placeholderer should stay mostly stateless and workflow-driven: import, validate, preview, generate, download, and leave—while the UI Builder adds a practical, self-contained way to create reusable placeholder UI assets without turning the product into a full design suite.
