import type { PptxElement, PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import AnimationPanel from './AnimationPanel.svelte';
import InspectorPanel from './InspectorPanel.svelte';

/**
 * AnimationPanel tests: the docked per-element animation editor (port of
 * React's `inspector/AnimationPanel.tsx`). Covers the render gate (selection
 * required), the add flow (entrance select creates a slide-level entry with
 * React's defaults), option edits (trigger / duration persist), removal
 * (clearing the only effect drops the entry), reorder (move up/down), undo
 * integration, and the InspectorPanel dock position.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeEl(id: string): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: {},
	} as PptxElement;
}

function makeEditor(elements: PptxElement[], animations?: PptxElementAnimation[]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	const slide = { id: 's1', rId: 'rId1', slideNumber: 1, elements, animations } as PptxSlide;
	editor.setSlides([slide]);
	return editor;
}

function mountPanel(editor: EditorState): { target: HTMLElement } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(AnimationPanel, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target };
}

function setSelect(target: HTMLElement, selector: string, value: string): void {
	const select = target.querySelector<HTMLSelectElement>(selector);
	expect(select, `missing select ${selector}`).not.toBeNull();
	select!.value = value;
	select!.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

function setInput(target: HTMLElement, selector: string, value: string): void {
	const input = target.querySelector<HTMLInputElement>(selector);
	expect(input, `missing input ${selector}`).not.toBeNull();
	input!.value = value;
	input!.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('animationPanel', () => {
	it('renders nothing when no element is selected', () => {
		const editor = makeEditor([shapeEl('a')]);
		const { target } = mountPanel(editor);

		expect(target.querySelector('[data-pptx-animation-panel]')).toBeNull();
	});

	it('renders effect selects for a selection and full controls + timeline for an animated one', () => {
		const editor = makeEditor(
			[shapeEl('a')],
			[{ elementId: 'a', entrance: 'fadeIn', durationMs: 500, order: 0, trigger: 'onClick' }],
		);
		editor.select('a');
		const { target } = mountPanel(editor);

		expect(target.querySelector('[data-pptx-animation-panel]')).not.toBeNull();
		expect(target.querySelector<HTMLSelectElement>('.pptx-svelte-animp-entrance')?.value).toBe(
			'fadeIn',
		);
		expect(target.querySelector('.pptx-svelte-animp-emphasis')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-animp-exit')).not.toBeNull();
		// Timing block + timeline only exist because the selection is animated.
		expect(target.querySelector('.pptx-svelte-animp-trigger')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-animp-duration')).not.toBeNull();
		expect(target.querySelectorAll('.pptx-svelte-animtl-row')).toHaveLength(1);
		expect(target.querySelector('.pptx-svelte-animp-preview')).not.toBeNull();
	});

	it('adds a slide-level animation entry with React defaults when an entrance is chosen', () => {
		const editor = makeEditor([shapeEl('a')]);
		editor.select('a');
		const { target } = mountPanel(editor);

		expect(target.querySelector('.pptx-svelte-animp-trigger')).toBeNull();
		setSelect(target, '.pptx-svelte-animp-entrance', 'fadeIn');

		expect(editor.slides[0].animations).toStrictEqual([
			{ elementId: 'a', entrance: 'fadeIn', durationMs: 500, order: 0, trigger: 'onClick' },
		]);
		expect(editor.dirty).toBeTruthy();
		// Timing controls appear once the entry exists.
		expect(target.querySelector('.pptx-svelte-animp-trigger')).not.toBeNull();
	});

	it('persists option edits: trigger and duration', () => {
		const editor = makeEditor(
			[shapeEl('a')],
			[{ elementId: 'a', entrance: 'fadeIn', durationMs: 500, order: 0, trigger: 'onClick' }],
		);
		editor.select('a');
		const { target } = mountPanel(editor);

		setSelect(target, '.pptx-svelte-animp-trigger', 'afterPrevious');
		expect(editor.slides[0].animations?.[0].trigger).toBe('afterPrevious');

		setInput(target, '.pptx-svelte-animp-duration', '800');
		expect(editor.slides[0].animations?.[0].durationMs).toBe(800);
		expect(editor.dirty).toBeTruthy();
	});

	it('shows the direction picker for directional presets and persists a pick', () => {
		const editor = makeEditor(
			[shapeEl('a')],
			[{ elementId: 'a', entrance: 'flyIn', durationMs: 500, order: 0, trigger: 'onClick' }],
		);
		editor.select('a');
		const { target } = mountPanel(editor);

		const buttons = target.querySelectorAll<HTMLButtonElement>(
			'.pptx-svelte-animp-direction-row button',
		);
		expect(buttons).toHaveLength(4);
		buttons[2].click(); // fromLeft
		flushSync();
		expect(editor.slides[0].animations?.[0].direction).toBe('fromLeft');
	});

	it('removes the entry when the only effect is set back to none', () => {
		const editor = makeEditor(
			[shapeEl('a')],
			[{ elementId: 'a', entrance: 'fadeIn', durationMs: 500, order: 0, trigger: 'onClick' }],
		);
		editor.select('a');
		const { target } = mountPanel(editor);

		setSelect(target, '.pptx-svelte-animp-entrance', 'none');

		expect(editor.slides[0].animations).toStrictEqual([]);
		expect(editor.dirty).toBeTruthy();
	});

	it('reorders animations via the move down button and re-normalises order', () => {
		const editor = makeEditor(
			[shapeEl('a'), shapeEl('b')],
			[
				{ elementId: 'a', entrance: 'fadeIn', durationMs: 500, order: 0, trigger: 'onClick' },
				{ elementId: 'b', entrance: 'zoomIn', durationMs: 500, order: 1, trigger: 'onClick' },
			],
		);
		editor.select('a');
		const { target } = mountPanel(editor);

		const rows = target.querySelectorAll('.pptx-svelte-animtl-row');
		expect(rows).toHaveLength(2);
		const moveDown = rows[0].querySelectorAll<HTMLButtonElement>(
			'.pptx-svelte-animtl-move button',
		)[1];
		moveDown.click();
		flushSync();

		const sorted = [...(editor.slides[0].animations ?? [])].sort(
			(x, y) => (x.order ?? 0) - (y.order ?? 0),
		);
		expect(sorted.map((animation) => animation.elementId)).toStrictEqual(['b', 'a']);
		expect(sorted.map((animation) => animation.order)).toStrictEqual([0, 1]);
	});

	it('integrates with editor undo: adding an animation is one undoable step', () => {
		const editor = makeEditor([shapeEl('a')]);
		editor.select('a');
		const { target } = mountPanel(editor);

		setSelect(target, '.pptx-svelte-animp-entrance', 'fadeIn');
		expect(editor.slides[0].animations).toHaveLength(1);
		expect(editor.canUndo).toBeTruthy();

		editor.undo();
		flushSync();
		expect(editor.slides[0].animations ?? []).toStrictEqual([]);
	});

	it('docks at the bottom of InspectorPanel whenever an element is selected', () => {
		const editor = makeEditor([shapeEl('a')]);
		const targetHost = document.createElement('div');
		document.body.appendChild(targetHost);
		const instance = mount(InspectorPanel, { target: targetHost, props: { editor } });
		flushSync();
		cleanup = () => {
			unmount(instance);
			targetHost.remove();
		};

		expect(targetHost.querySelector('[data-pptx-animation-panel]')).toBeNull();
		editor.select('a');
		flushSync();
		const aside = targetHost.querySelector('aside');
		const dock = targetHost.querySelector('[data-pptx-animation-panel]');
		expect(dock).not.toBeNull();
		// Docked after (below) the scrolling tab body, direct child of the pane.
		expect(dock?.parentElement).toBe(aside);
		expect(
			dock?.previousElementSibling?.classList.contains('pptx-svelte-inspector-body'),
		).toBeTruthy();
	});
});
