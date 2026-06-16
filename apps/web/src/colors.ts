// Theme-aware color tokens used in inline styles throughout the app.
// Each value is a CSS variable reference; styles.css defines the
// actual light/dark values. Toggling the theme on <html> swaps them
// without any React re-render.

export const colors = {
  bg: 'var(--ph-bg)',
  bgElevated: 'var(--ph-bg-elevated)',
  bgInset: 'var(--ph-bg-inset)',

  text: 'var(--ph-text)',
  textMuted: 'var(--ph-text-muted)',
  textDim: 'var(--ph-text-dim)',

  border: 'var(--ph-border)',
  borderStrong: 'var(--ph-border-strong)',

  accent: 'var(--ph-accent)',
  accentHover: 'var(--ph-accent-hover)',

  success: 'var(--ph-success)',
  successBg: 'var(--ph-success-bg)',
  successBorder: 'var(--ph-success-border)',
  error: 'var(--ph-error)',
  errorBg: 'var(--ph-error-bg)',
  errorBorder: 'var(--ph-error-border)',
  errorText: 'var(--ph-error-text)',
};
