/**
 * template-editing.ts: the editTemplateMode helpers, re-exported from shared.
 *
 * Template elements (decorative shapes a slide inherits from its layout or
 * master) carry a `layout-` / `master-` id prefix. The core loader merges them
 * into `slide.elements`; at load time the viewer partitions them OUT into a
 * dedicated `templateElementsBySlideId` store so they get their own editable
 * render layer that is interaction-locked unless the user turns on "edit
 * template" mode. Because editing one mutates the shared master/layout part, the
 * separate store is merged BACK in front of each slide's own elements at save
 * time via {@link buildSaveSlides} so template edits persist.
 *
 * None of that is React-specific and `pptx-viewer-shared` owns it, so this
 * module only re-exports: one implementation for all five bindings. It remains a
 * module because the hooks here import it by name in several places.
 *
 * @module utils/template-editing
 */

// The clone-id builder (template-prefix aware paste/duplicate ids) lives in
// `pptx-viewer-shared` (render/element-clipboard.ts).
export { buildSaveSlides, makeCloneId, partitionTemplateElements } from 'pptx-viewer-shared';
export type { TemplateElementPartition as TemplatePartition } from 'pptx-viewer-shared';
