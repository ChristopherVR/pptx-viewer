/**
 * Thin re-export shim -> `pptx-viewer-shared`.
 *
 * The Browse Themes gallery preset set now lives in `pptx-viewer-shared`
 * (`theme/theme-gallery-presets`). This shim preserves the historical import
 * surface (`GALLERY_THEME_PRESETS`) for Vue's ThemeGallery component.
 */
export { GALLERY_THEME_PRESETS } from 'pptx-viewer-shared';
