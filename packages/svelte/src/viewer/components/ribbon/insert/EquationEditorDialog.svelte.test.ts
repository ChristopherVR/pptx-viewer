import { EQUATION_TEMPLATES } from 'pptx-viewer-shared';
import type { CanvasSize } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import EquationEditorDialog from './EquationEditorDialog.svelte';

/**
 * EquationEditorDialog tests: the modal LaTeX editor (live MathML preview +
 * template gallery + insert/update). Named `*.svelte.test.ts` (not plain
 * `.test.ts`) so `mountDialog` can wrap the mounted `open` prop in
 * `$state(...)`, keeping it reactive after `mount()` when a test needs to
 * flip it (see `notes-panel.svelte.test.ts` for the same pattern/rationale).
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

function mountDialog(editor: EditorState, open: boolean, onclose: () => void): MountResult {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ editor, canvasSize: CANVAS, open, onclose });
	const instance = mount(EquationEditorDialog, { target, props });
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

function typeLatex(target: HTMLElement, latex: string): void {
	const textarea = target.querySelector<HTMLTextAreaElement>('textarea');
	if (!textarea) {
		throw new Error('textarea not found');
	}
	textarea.value = latex;
	textarea.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
}

function footerButtons(target: HTMLElement): HTMLButtonElement[] {
	return [...target.querySelectorAll<HTMLButtonElement>('footer button')];
}

describe('equationEditorDialog', () => {
	it('renders nothing while closed', () => {
		const { target } = mountDialog(makeEditor(), false, vi.fn());
		expect(target.querySelector('[role="dialog"]')).toBeNull();
	});

	it('renders the modal dialog while open', () => {
		const { target } = mountDialog(makeEditor(), true, vi.fn());
		expect(target.querySelector('[role="dialog"]')).not.toBeNull();
		expect(target.querySelector('.backdrop')).not.toBeNull();
	});

	it('shows the placeholder preview text until LaTeX is entered', () => {
		const { target } = mountDialog(makeEditor(), true, vi.fn());
		const preview = target.querySelector('.preview');
		expect(preview?.textContent?.trim().length).toBeGreaterThan(0);
		expect(preview?.querySelector('mi')).toBeNull();
	});

	it('renders a live sanitized MathML preview as LaTeX is typed', () => {
		const { target } = mountDialog(makeEditor(), true, vi.fn());
		typeLatex(target, 'x+y');
		// sanitizeMathMl strips the outer <math> wrapper, keeping the inner
		// MathML token elements (<mi>/<mo>/...).
		expect(target.querySelector('.preview')?.querySelectorAll('mi')).toHaveLength(2);
	});

	it('renders the full shared template gallery with MathML tiles', () => {
		const { target } = mountDialog(makeEditor(), true, vi.fn());
		const tiles = target.querySelectorAll('.template');
		expect(tiles).toHaveLength(EQUATION_TEMPLATES.length);
		expect(tiles[0]?.querySelector('mfrac, mi, mo, mrow')).not.toBeNull();
	});

	it('seeds the LaTeX input when a template tile is clicked', () => {
		const { target } = mountDialog(makeEditor(), true, vi.fn());
		const tile = target.querySelector<HTMLButtonElement>('.template');
		tile?.click();
		flushSync();
		const textarea = target.querySelector<HTMLTextAreaElement>('textarea');
		expect(textarea?.value).toBe(EQUATION_TEMPLATES[0]?.latex);
		expect(tile?.classList.contains('active')).toBeTruthy();
	});

	it('disables Insert until valid LaTeX is entered', () => {
		const { target } = mountDialog(makeEditor(), true, vi.fn());
		const [, insertBtn] = footerButtons(target);
		expect(insertBtn?.disabled).toBeTruthy();
		typeLatex(target, 'x+y');
		expect(insertBtn?.disabled).toBeFalsy();
	});

	it('inserts an equation shape and closes on Insert', () => {
		const editor = makeEditor();
		const onclose = vi.fn();
		const { target } = mountDialog(editor, true, onclose);

		typeLatex(target, 'x+y');
		footerButtons(target)[1]?.click();
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
		const { target } = mountDialog(editor, true, onclose);

		footerButtons(target)[0]?.click();
		flushSync();

		expect(editor.slides[0]?.elements).toHaveLength(0);
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('re-seeds from the edited equation on every open, and clears for a fresh insert', () => {
		const editor = makeEditor();
		editor.setSlides([
			{
				id: 's1',
				rId: 'rId1',
				slideNumber: 1,
				elements: [
					{
						id: 'eq1',
						type: 'shape',
						x: 0,
						y: 0,
						width: 100,
						height: 40,
						text: '[Equation]',
						textSegments: [
							{
								text: '[Equation]',
								equationXml: { 'm:oMath': { 'm:r': { 'm:t': 'x' } } },
							},
						],
					},
				],
			},
		]);
		const { target, setProps } = mountDialog(editor, false, vi.fn());

		expect(editor.equationOps.open('eq1')).toBeTruthy();
		setProps({ open: true });
		let textarea = target.querySelector<HTMLTextAreaElement>('textarea');
		expect(textarea?.value).toBe('x');

		// Cancel the edit, then reopen the same equation: it must reseed.
		typeLatex(target, 'stale garbage');
		setProps({ open: false });
		editor.equationOps.close();
		expect(editor.equationOps.open('eq1')).toBeTruthy();
		setProps({ open: true });
		textarea = target.querySelector<HTMLTextAreaElement>('textarea');
		expect(textarea?.value).toBe('x');

		// Close again and reopen for a fresh insert: it must start empty.
		setProps({ open: false });
		editor.equationOps.close();
		setProps({ open: true });
		textarea = target.querySelector<HTMLTextAreaElement>('textarea');
		expect(textarea?.value).toBe('');
	});
});
