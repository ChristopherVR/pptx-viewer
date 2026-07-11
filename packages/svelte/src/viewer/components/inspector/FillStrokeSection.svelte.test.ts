import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import FillStrokeSection from './FillStrokeSection.svelte';

/**
 * FillStrokeSection tests: flat fill/stroke colour, fill/stroke opacity
 * sliders, and the gradient toggle (which also verifies picking a flat
 * colour clears an active gradient's `fillMode`, matching the vanilla
 * binding's parity fix). Named `*.svelte.test.ts` so `mountSection`'s props
 * object can be wrapped in `$state(...)` and updated between interactions
 * that depend on the previous commit (see `notes-panel.svelte.test.ts`).
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeEl(over: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#ff0000', strokeColor: '#0000ff' },
		...over,
	} as PptxElement;
}

function makeEditor(el: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	editor.select(el.id);
	return editor;
}

function currentEl(editor: EditorState): PptxElement {
	const el = editor.slides[0]?.elements[0];
	if (!el) {
		throw new Error('element missing');
	}
	return el;
}

interface MountResult {
	target: HTMLElement;
	setProps: (next: { el: PptxElement }) => void;
}

function mountSection(editor: EditorState, el: PptxElement): MountResult {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const props = $state({ editor, el });
	const instance = mount(FillStrokeSection, { target, props });
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

function colorInputs(target: HTMLElement): HTMLInputElement[] {
	return Array.from(target.querySelectorAll<HTMLInputElement>('input[type="color"]'));
}

function rangeInputs(target: HTMLElement): HTMLInputElement[] {
	return Array.from(target.querySelectorAll<HTMLInputElement>('input[type="range"]'));
}

describe('fillStrokeSection', () => {
	it('renders the current fill and stroke colour', () => {
		const editor = makeEditor(shapeEl());
		const { target } = mountSection(editor, currentEl(editor));
		const [fill, stroke] = colorInputs(target);
		expect(fill?.value).toBe('#ff0000');
		expect(stroke?.value).toBe('#0000ff');
	});

	it('sets the fill colour and forces fillMode back to solid, undoably', () => {
		const editor = makeEditor(
			shapeEl({ shapeStyle: { fillMode: 'gradient', fillColor: '#ff0000' } }),
		);
		const { target } = mountSection(editor, currentEl(editor));
		const [fill] = colorInputs(target);
		if (!fill) {
			throw new Error('fill input not found');
		}
		fill.value = '#00ff00';
		fill.dispatchEvent(new Event('change', { bubbles: true }));
		flushSync();

		const el = currentEl(editor) as { shapeStyle?: { fillColor?: string; fillMode?: string } };
		expect(el.shapeStyle?.fillColor).toBe('#00ff00');
		expect(el.shapeStyle?.fillMode).toBe('solid');
		expect(editor.canUndo).toBeTruthy();
	});

	it('sets fill/stroke opacity via the sliders', () => {
		const editor = makeEditor(shapeEl());
		const { target, setProps } = mountSection(editor, currentEl(editor));
		const [fillOpacity, strokeOpacity] = rangeInputs(target);
		if (!fillOpacity || !strokeOpacity) {
			throw new Error('opacity sliders not found');
		}
		fillOpacity.value = '0.4';
		fillOpacity.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();
		// Re-sync the `el` prop with the just-committed slides so the second
		// slider's patch merges onto the post-first-commit shapeStyle, mirroring
		// how the live `editor.selectedElement` derivation refreshes it in the
		// real InspectorPanel tree.
		setProps({ el: currentEl(editor) });
		strokeOpacity.value = '0.7';
		strokeOpacity.dispatchEvent(new Event('input', { bubbles: true }));
		flushSync();

		const el = currentEl(editor) as {
			shapeStyle?: { fillOpacity?: number; strokeOpacity?: number };
		};
		expect(el.shapeStyle?.fillOpacity).toBe(0.4);
		expect(el.shapeStyle?.strokeOpacity).toBe(0.7);
	});

	it('shows the gradient sub-panel only while the gradient toggle is on', () => {
		const editor = makeEditor(shapeEl());
		const { target, setProps } = mountSection(editor, currentEl(editor));
		expect(target.querySelector('.pptx-svelte-gradient')).toBeNull();

		const toggle = target.querySelector<HTMLInputElement>(
			'.pptx-svelte-field-checkbox input[type="checkbox"]',
		);
		toggle?.click();
		flushSync();
		setProps({ el: currentEl(editor) });

		const el = currentEl(editor) as { shapeStyle?: { fillMode?: string } };
		expect(el.shapeStyle?.fillMode).toBe('gradient');
		expect(target.querySelector('.pptx-svelte-gradient')).not.toBeNull();
	});
});
