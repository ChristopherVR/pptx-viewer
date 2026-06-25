/**
 * OOXML built-in action button presets and default action map.
 *
 * The presets + default-action map now live in `pptx-viewer-shared`
 * (`render/action-buttons.ts`) so every binding shares one copy. This module
 * stays as a thin re-export shim for the existing React import sites.
 */

export { ACTION_BUTTON_DEFAULT_ACTIONS, ACTION_BUTTON_PRESETS } from 'pptx-viewer-shared';
