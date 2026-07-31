/**
 * Thin re-export shim. The theme-editor preset palettes and font list are pure
 * data shared by every binding's "Edit theme" panel, so they live in
 * `pptx-viewer-shared`; this module keeps React's existing import path working.
 */
export { PRESET_THEMES, COMMON_FONTS, DEFAULT_THEME_COLOR_SCHEME } from 'pptx-viewer-shared';
export type { PresetTheme } from 'pptx-viewer-shared';
