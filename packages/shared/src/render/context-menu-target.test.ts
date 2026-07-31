import { describe, expect, it } from 'vitest';

import type { ContextMenuTargetNode } from './context-menu-target';
import {
	INLINE_EDITOR_SELECTOR,
	isInsideInlineEditor,
	resolveContextMenuElementId,
} from './context-menu-target';

/** A stand-in for a DOM node whose `closest` only knows the selectors listed. */
function node(...matches: string[]): ContextMenuTargetNode {
	const self: ContextMenuTargetNode = {
		closest: (selectors) => (matches.includes(selectors) ? self : null),
	};
	return self;
}

describe('isInsideInlineEditor', () => {
	it('recognises a node inside the inline editor surface', () => {
		expect(isInsideInlineEditor(node(INLINE_EDITOR_SELECTOR))).toBeTruthy();
	});

	it('rejects a node outside it, and anything that is not a node', () => {
		expect(isInsideInlineEditor(node('[data-element-id]'))).toBeFalsy();
		expect(isInsideInlineEditor(null)).toBeFalsy();
		expect(isInsideInlineEditor(undefined)).toBeFalsy();
		// An EventTarget with no `closest` (window, document, a media element).
		expect(
			isInsideInlineEditor({ addEventListener: () => {} } as unknown as EventTarget),
		).toBeFalsy();
	});
});

describe('resolveContextMenuElementId', () => {
	it('keeps the id the binding hit-tested, editor open or not', () => {
		expect(resolveContextMenuElementId('el1', node(INLINE_EDITOR_SELECTOR), 'el9')).toBe('el1');
		expect(resolveContextMenuElementId('el1', node(), null)).toBe('el1');
	});

	/**
	 * The defect itself: the editor is a sibling overlay, so the hit-test comes
	 * back empty and, before this fallback, the right-click opened nothing.
	 */
	it('falls back to the element being edited when the click landed in its editor', () => {
		expect(resolveContextMenuElementId(null, node(INLINE_EDITOR_SELECTOR), 'el1')).toBe('el1');
	});

	it('resolves nothing for a click on bare canvas', () => {
		expect(resolveContextMenuElementId(null, node(), 'el1')).toBeNull();
		expect(resolveContextMenuElementId(null, node(INLINE_EDITOR_SELECTOR), null)).toBeNull();
	});
});
