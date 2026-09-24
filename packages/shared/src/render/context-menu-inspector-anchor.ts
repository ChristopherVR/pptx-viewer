/**
 * Which inspector section a "format object" context-menu command should
 * scroll into view, once the binding has switched the sidebar to the element
 * properties tab.
 *
 * PowerPoint's "Edit Alt Text", "Size and Position" and "Format Shape" each
 * open a dedicated task pane; this viewer keeps one scrollable properties
 * panel instead, so the closest equivalent is jumping straight to the
 * matching section of it rather than making the user hunt for it. A binding
 * that has not tagged its sections with {@link INSPECTOR_SECTION_ATTRIBUTE}
 * still opens the properties tab (the command is never a no-op); it only
 * misses the extra scroll, which degrades gracefully since
 * {@link scrollInspectorSectionIntoView} is a no-op when the node is absent.
 *
 * @module render/context-menu-inspector-anchor
 */
import type { ContextMenuCommandId } from './context-menu-commands';

/** One inspector section a context-menu command can jump to. */
export type InspectorSectionAnchor = 'transform' | 'fill-stroke' | 'alt-text';

/**
 * The DOM attribute a binding puts on its section wrapper so this module can
 * find it, e.g. `<div data-pptx-inspector-section="transform">`.
 */
export const INSPECTOR_SECTION_ATTRIBUTE = 'data-pptx-inspector-section';

/** The section a command should reveal, or `null` when it does not target one. */
export function contextMenuInspectorAnchor(
	id: ContextMenuCommandId,
): InspectorSectionAnchor | null {
	switch (id) {
		case 'size-and-position':
			return 'transform';
		case 'format-shape':
			return 'fill-stroke';
		case 'edit-alt-text':
			return 'alt-text';
		default:
			return null;
	}
}

/**
 * Scroll the tagged section into view, when present. Call after the binding
 * has switched to the properties tab and let it mount/render; a section that
 * is not tagged (or not yet mounted) is silently skipped, so this is always
 * safe to call.
 */
export function scrollInspectorSectionIntoView(
	doc: Document,
	anchor: InspectorSectionAnchor,
): void {
	const node = doc.querySelector(`[${INSPECTOR_SECTION_ATTRIBUTE}="${anchor}"]`);
	node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
