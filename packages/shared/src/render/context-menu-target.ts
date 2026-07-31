/**
 * Resolve which slide element a canvas right-click belongs to, including the
 * case where the click landed inside an open inline text editor.
 *
 * Every binding resolves a context-menu target by walking up from the event
 * target to the nearest `[data-element-id]` node. That walk fails the moment an
 * inline text editor is open, because four of the five bindings mount the
 * editor as a sibling overlay of the rendered elements rather than as a child
 * of the element it edits: the editor has to paint above the selection chrome
 * and escape the element's own clipping, so nothing above the caret carries an
 * element id. The right-click then resolves to nothing and the menu never
 * opens, for exactly the element the user had just clicked, which is the one
 * they are most likely to want it on.
 *
 * The editor surface carries `data-inline-editor` in every binding, and the
 * binding already knows which element is being edited, so the fallback is an
 * exact lookup rather than a geometric guess.
 *
 * @module render/context-menu-target
 */

/** Attribute marking the inline text-editing surface in every binding. */
export const INLINE_EDITOR_SELECTOR = '[data-inline-editor]';

/**
 * The slice of `Element` used here. Declaring it structurally keeps the helper
 * unit-testable without a DOM and free of a `lib.dom` dependency.
 */
export interface ContextMenuTargetNode {
	closest(selectors: string): ContextMenuTargetNode | null;
}

/** True when `target` sits inside (or is) an open inline text editor. */
export function isInsideInlineEditor(
	target: ContextMenuTargetNode | EventTarget | null | undefined,
): boolean {
	if (!target || !('closest' in target) || typeof target.closest !== 'function') {
		return false;
	}
	return target.closest(INLINE_EDITOR_SELECTOR) !== null;
}

/**
 * The element the context menu should act on.
 *
 * `directId` is whatever the binding's own `[data-element-id]` hit-test found
 * (null when it found nothing). Only when that fails does the inline-editor
 * fallback apply, so a right-click on a *different* element while an editor is
 * open still targets the element under the cursor.
 */
export function resolveContextMenuElementId(
	directId: string | null | undefined,
	target: ContextMenuTargetNode | EventTarget | null | undefined,
	inlineEditingElementId: string | null | undefined,
): string | null {
	if (directId) {
		return directId;
	}
	if (!inlineEditingElementId) {
		return null;
	}
	return isInsideInlineEditor(target) ? inlineEditingElementId : null;
}
