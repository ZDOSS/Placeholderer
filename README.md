# Placeholderer

Placeholder asset generator for game developers (v1).

Browser-first PWA + CLI with shared TypeScript core.

## Prerequisites

- Node.js 20+
- pnpm (recommended package manager)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Run the Web App (Development)

```bash
pnpm --filter web dev
```

Then open http://localhost:5173

### 3. Build the Web App

```bash
pnpm --filter web build
```

### 4. Run the CLI

```bash
pnpm --filter cli build
node apps/cli/dist/index.js --help
```

## Project Structure

```
placeholderer/
├── apps/
│   ├── web/          # Vite + React PWA
│   └── cli/          # Commander CLI
├── packages/
│   ├── schemas/      # JSON schemas + types
│   ├── core/         # Validation, sanitization, generation
│   └── templates/    # (future) Engine templates
├── package.json
└── pnpm-workspace.yaml
```

## Current Status

- Monorepo with pnpm workspaces initialized
- Full manifest + builder recipe JSON schemas
- Core validation and path sanitization
- Working web app with:
  - JSON paste import
  - Manifest validation
  - Job Overview with collapsible requests
- CLI skeleton

See `.hermes/desktop-attachments/placeholderer-v1-spec-draft.md` for the full product spec.

## Next

- Full generation logic (Canvas-based rendering)
- UI Builder
- File upload support
- ZIP export

## License

MIT