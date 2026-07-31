/**
 * Per-slide specialisation of the presentation-wide field-substitution context.
 *
 * The implementation is framework-agnostic and lives in `pptx-viewer-shared`
 * (`render/field-context`); this module re-exports it so the existing React
 * import path keeps working.
 *
 * It used to be a local copy whose title scan read an element's
 * `placeholderType` property. Nothing sets that property on a parsed deck (the
 * placeholder type stays in the preserved raw XML, and a title's text may live
 * in `textSegments` rather than `text`), so every `slidetitle` field on a real
 * `.pptx` fell through to its cached literal, "Title". The shared helper
 * delegates to core's `deriveSlideTitle` instead, which is the same resolution
 * `docProps/app.xml` is written from.
 */
export { deriveSlideFieldContext } from 'pptx-viewer-shared';
