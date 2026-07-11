import type { CanvasSize } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import EquationPanel from './EquationPanel.svelte';

/**
 * EquationPanel tests: the docked LaTeX input + live MathML preview. Named
 * `*.svelte.test.ts` (not plain `.test.ts`) so `mountPanel` can wrap the
 * mounted `open` prop in `$state(...)`, keeping it reactive after `mount()`
 * when a test needs to flip it (see `notes-panel.svelte.test.ts` for the same
 * pattern/rationale).
 */

const CANVAS: CanvasSize = { width: 960, height: 540 };

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(editable = true): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = editable;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	return editor;
}

interface MountResult {
	target: HTMLElement;
	setProps: (next: { open?: boolean }) => void;
}

function mountPanel(editor: EditorState, open: boolean, onclose: () => void): MountResult {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ editor, canvasSize: CANVAS, open, onclose });
	const instance = mount(EquationPanel, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return {
		target,
		setProps: (next) => {
			Object.assign(props, next);
			flushSync();
		},
	};
}

describe('equationPanel', () => {
	it('renders nothing while closed', () => {
		const { target } = mountPanel(makeEditor(), false, vi.fn());
		expect(target.querySelector('[role="dialog"]')).toBeNull();
	});

	it('renders the docked dialog while open', () => {
		const { target } = mountPanel(makeEditor(), true, vi.fn());
		expect(target.querySelector('[role="dialog"]')).not.toBeNull();
	});

	it('shows the placeholder preview text until LaTeX is entered', () => {
		const { target } = mountPanel(makeEditor(), true, vi.fn());
		const preview = target.querySelector('.pptx-svelte-equation-preview');
		expect(preview?.textContent?.trim().length).toBeGreaterThan(0);
		expect(preview?.querySelector('mi')).toBeNull();
	});

	it('renders a live sanitized MathML preview as LaTeX is typed', () => {
		const { target } = mountPanel(makeEditor(), true, vi.fn());
		const textarea = target.querySelector<HTMLTextAreaElement>('textarea');
		if (!textarea) {
			throw new Error('textarea not found');
		}
		textarea.value = 'x+y';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		const preview = target.querySelector('.pptx-svelte-equation-preview');
		// sanitizeMathMl strips the outer <math> wrapper, keeping the inner
		// MathML token elements (<mi>/<mo>/...).
		expect(preview?.querySelectorAll('mi')).toHaveLength(2);
	});

	it('disables Insert until LaTeX is entered', () => {
		const { target } = mountPanel(makeEditor(), true, vi.fn());
		const insertBtn = target.querySelector<HTMLButtonElement>('button');
		expect(insertBtn?.disabled).toBeTruthy();
	});

	it('inserts an equation shape and closes on Insert', () => {
		const editor = makeEditor();
		const onclose = vi.fn();
		const { target } = mountPanel(editor, true, onclose);

		const textarea = target.querySelector<HTMLTextAreaElement>('textarea');
		if (!textarea) {
			throw new Error('textarea not found');
		}
		textarea.value = 'x+y';
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		const buttons = target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-equation-row button');
		buttons[0]?.click();
		flushSync();

		const el = editor.slides[0]?.elements[0];
		expect(el?.type).toBe('shape');
		if (el?.type === 'shape') {
			expect(el.textSegments?.[0]?.equationXml).toBeTruthy();
		}
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('closes without inserting on Cancel', () => {
		const editor = makeEditor();
		const onclose = vi.fn();
		const { target } = mountPanel(editor, true, onclose);

		const buttons = target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-equation-row button');
		buttons[1]?.click();
		flushSync();

		expect(editor.slides[0]?.elements).toHaveLength(0);
		expect(onclose).toHaveBeenCalledOnce();
	});
});
