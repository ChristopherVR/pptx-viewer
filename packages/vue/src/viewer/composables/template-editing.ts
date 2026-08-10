/**
 * template-editing.ts: the editTemplateMode helpers, re-exported from shared.
 *
 * Template elements (decorative shapes a slide inherits from its layout or
 * master) are merged into `slide.elements` by the core loader, each carrying a
 * `layout-` / `master-` id prefix. They render on every slide that inherits the
 * same template part, so editing one mutates the shared part. To keep them out
 * of the normal editing flow, the viewer PARTITIONS them into their own store at
 * load time, renders them in a dedicated layer behind the slide content, routes
 * edits to that store, and merges them back in front of (behind) the slide
 * elements when serialising.
 *
 * None of that is Vue-specific, and `pptx-viewer-shared` already owns it, so
 * this module is a re-export: one implementation, five bindings. It stays as a
 * module (rather than every call site importing from shared directly) because
 * the composables here reference it by name in a dozen places and the indirection
 * costs nothing.
 *
 * @module composables/template-editing
 */
export {
	buildSaveSlides,
	findTemplateElement,
	isElementIdInteractive,
	partitionTemplateElements,
	setTemplateElements,
} from 'pptx-viewer-shared';
export type {
	TemplateElementMap,
	TemplateElementPartition as PartitionedSlides,
} from 'pptx-viewer-shared';
