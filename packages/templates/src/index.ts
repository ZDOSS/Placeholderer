// Engine templates and starter manifests.
//
// Starter content currently lives in `@placeholderer/core` (engines.ts)
// so the CLI and web app can import one package. This package re-exports
// those helpers and is the intended home for future offline template
// files, prompt libraries, and engine-specific sample packs.

export {
  ENGINE_GUIDES,
  TEMPLATE_TYPES,
  V1_ENGINES,
  V1_1_ENGINES,
  ALL_ENGINES,
  getGuide,
  buildStarterManifest,
  type EngineGuide,
  type TemplateType,
} from '@placeholderer/core';
