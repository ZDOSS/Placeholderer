# Placeholderer

Placeholder asset generator for game developers.

Browser-first PWA + CLI with a shared TypeScript core. Import a JSON or CSV
manifest, preview assets, generate placeholders (images, sprite sheets,
tilesets, UI panels, audio tones), and download a ZIP — or author UI
placeholders in the built-in UI Builder.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+

## Getting started

```bash
pnpm install
```

### Web app (development)

```bash
pnpm dev
# → http://localhost:5173
```

GitHub Pages deploys the production build from `main` under
`/Placeholderer/` (see `apps/web/vite.config.ts`).

### CLI

```bash
pnpm --filter cli build
node apps/cli/dist/index.js --help
```

Commands:

| Command | Purpose |
|---------|---------|
| `validate <file>` | Validate a manifest against the JSON Schema |
| `generate --in <file> [--out <zip>]` | Generate a ZIP of placeholders |
| `init-template <engine> <type>` | Write a starter manifest |
| `list-templates` | List engines and asset types |
| `explain-schema <kind>` | Print schema (or a sub-schema) |

### Build / test / lint

```bash
pnpm build          # all packages
pnpm test           # core + CLI unit tests
pnpm lint           # tsc --noEmit per package
pnpm e2e            # Playwright (web)
```

## Project structure

```
placeholderer/
├── apps/
│   ├── web/          # Vite + React PWA (import, overview, builder, templates)
│   └── cli/          # Commander CLI
├── packages/
│   ├── schemas/      # JSON Schema + TypeScript types
│   ├── core/         # Validation, sanitization, rendering, ZIP, CSV, engines
│   └── templates/    # Engine guide re-exports (extensible starter pack)
├── tests/e2e/        # Playwright
└── package.json
```

## What works today

- **JSON import** — paste or upload/drop a file; explicit Import button; AJV validation
- **CSV import** — type selector first, quoted fields, full schema validation
- **Job Overview** — collapsible requests, preview strips, Item Detail safe adjustments
- **Generation** — PNG/JPG/WebP/BMP/GIF images, WAV audio, ZIP with manifest/error reports
- **Rendering options** — labels, numbering styles, grid toggle, UI panel frame styles & guides, panel metadata sidecars, fill_mode checker overlay
- **UI Builder** — layers, presets, undo/redo, recipe import/export, PNG/JPG/BMP/GIF/SVG
- **Engine templates** — Godot, Unity, RPG Maker, GameMaker, Unreal (+ v1.1 engines)
- **AI-driven mode** — preference in localStorage; prompt + JSON copy on Templates
- **Theming** — light/dark via `localStorage`

## Known limitations

- **Dual builder renderers:** the web UI Builder supports pattern/image fills and SVG export. Manifest `builder_recipe` assets generated via shared `generateJob` (web download or CLI) use a **solid-fill subset** in `@placeholderer/core`. Prefer exporting images from the Builder when fill fidelity matters.
- **`custom_fill_image`:** accepted by the schema; core draws a procedural checker when `fill_mode` is `repeat` or a fill image path is set. Loading arbitrary raster URLs into core is not implemented (env-specific).
- **Fonts:** system font stack only (offline-friendly); no bundled webfonts yet.
- **Interactive builder workflows** (drag layers, live edit) are web-only; CLI does not edit recipes.

Full product/technical intent lives in
[`.hermes/desktop-attachments/placeholderer-v1-spec-draft.md`](.hermes/desktop-attachments/placeholderer-v1-spec-draft.md).

## License

MIT
