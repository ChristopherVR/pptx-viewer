import { describe, expect, it, vi } from 'vitest';

import { armEditorKeyboard } from './editor-keyboard-focus';
import type { EditorKeyboardFocusTarget } from './editor-keyboard-focus';

/** A viewer root stub whose owning document reports `active` as focused. */
function root(
	active: Node | null,
	containsActive: boolean,
): EditorKeyboardFocusTarget & {
	focus: ReturnType<typeof vi.fn>;
} {
	const body = { nodeName: 'BODY' } as unknown as Node;
	return {
		contains: () => containsActive,
		focus: vi.fn(),
		ownerDocument: { activeElement: active, body } as unknown as Document,
	};
}

describe('armEditorKeyboard', () => {
	it('focuses the root when focus fell outside it', () => {
		const target = root(null, false);
		expect(armEditorKeyboard(target)).toBeTruthy();
		expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
	});

	it('leaves an inline editor inside the viewer holding focus', () => {
		const inner = { nodeName: 'DIV' } as unknown as Node;
		const target = root(inner, true);
		expect(armEditorKeyboard(target)).toBeTruthy();
		expect(target.focus).not.toHaveBeenCalled();
	});

	it('reclaims focus from document.body even though the body contains the root', () => {
		const body = { nodeName: 'BODY' } as unknown as Node;
		const target: EditorKeyboardFocusTarget & { focus: ReturnType<typeof vi.fn> } = {
			contains: () => true,
			focus: vi.fn(),
			ownerDocument: { activeElement: body, body } as unknown as Document,
		};
		armEditorKeyboard(target);
		expect(target.focus).toHaveBeenCalledOnce();
	});

	it('is a no-op without a root', () => {
		expect(armEditorKeyboard(null)).toBeFalsy();
		expect(armEditorKeyboard(undefined)).toBeFalsy();
	});
});
