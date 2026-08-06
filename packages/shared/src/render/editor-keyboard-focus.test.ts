// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { armEditorKeyboard, restoreEditorKeyboardFocus } from './editor-keyboard-focus';
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

describe('restoreEditorKeyboardFocus', () => {
	afterEach(() => document.body.replaceChildren());

	/** A viewer root (tabindex, as every binding renders it) holding a panel input. */
	function pane(): { viewer: HTMLDivElement; input: HTMLInputElement } {
		const viewer = document.createElement('div');
		viewer.setAttribute('tabindex', '0');
		const panel = document.createElement('aside');
		const input = document.createElement('input');
		panel.append(input);
		viewer.append(panel);
		document.body.append(viewer);
		return { viewer, input };
	}

	it('hands focus back to the viewer root when the inline editor still holds it', () => {
		const { viewer, input } = pane();
		input.focus();
		expect(document.activeElement).toBe(input);

		expect(restoreEditorKeyboardFocus(input)).toBeTruthy();
		expect(document.activeElement).toBe(viewer);
	});

	it('does not leave focus on the body once the editor is removed', () => {
		const { viewer, input } = pane();
		input.focus();
		restoreEditorKeyboardFocus(input);
		input.remove();
		expect(document.activeElement).toBe(viewer);
	});

	it('reports false when nothing up the tree can take the keyboard', () => {
		const orphan = document.createElement('input');
		document.body.append(orphan);
		expect(restoreEditorKeyboardFocus(orphan)).toBeFalsy();
		expect(restoreEditorKeyboardFocus(null)).toBeFalsy();
		expect(restoreEditorKeyboardFocus(undefined)).toBeFalsy();
	});
});
