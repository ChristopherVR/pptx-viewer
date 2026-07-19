/**
 * Thin re-export shim -> `pptx-viewer-shared` (via the vendored copy).
 *
 * The Browse Themes gallery preset set now lives in `pptx-viewer-shared`
 * (`theme/theme-gallery-presets`). This shim preserves the historical import
 * surface (`GALLERY_THEME_PRESETS`) for Angular's theme-gallery component.
 */
export { GALLERY_THEME_PRESETS } from '../internal/shared';
