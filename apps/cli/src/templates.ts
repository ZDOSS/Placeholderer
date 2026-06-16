// Re-export from @placeholderer/core so the rest of the CLI has a
// single import path. The canonical engine catalog lives in
// packages/core/src/engines.ts so the web Templates page and the CLI
// stay in sync.

export {
  ALL_ENGINES,
  V1_ENGINES,
  V1_1_ENGINES,
  TEMPLATE_TYPES,
  isValidEngine,
  isValidType,
  buildStarterManifest,
  getGuide,
  type EngineGuide,
  type TemplateType,
} from '@placeholderer/core';
