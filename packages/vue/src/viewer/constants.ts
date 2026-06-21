// These mirror the values in pptx-viewer-shared/constants.ts. They are
// hardcoded here rather than imported because the Vite 8 Rolldown bundler
// panics when symbols from a bundled workspace package are referenced
// across the entry-point / dynamic-chunk boundary created by the
// SmartArt3DRenderer lazy import.
export const DEFAULT_CANVAS_WIDTH = 1280;
export const DEFAULT_CANVAS_HEIGHT = 720;
export const DEFAULT_TEXT_COLOR = '#111827';
export const DEFAULT_FILL_COLOR = '#3b82f6';
export const DEFAULT_STROKE_COLOR = '#1f2937';
