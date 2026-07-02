/**
 * table-styles.ts: thin re-export shim.
 *
 * The table quick-style preset catalogue now lives in `pptx-viewer-shared`
 * (`render/table-style-presets.ts`) so React, Vue and Angular share one copy.
 * This module preserves the original public symbol surface so existing
 * imports (`../../constants`) keep working unchanged.
 */
export { TABLE_STYLE_PRESETS, type TableStylePreset } from 'pptx-viewer-shared';
