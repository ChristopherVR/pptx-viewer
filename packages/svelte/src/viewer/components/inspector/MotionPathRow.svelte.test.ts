import type { PptxElement, PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import { MOTION_PATH_PRESETS, motionPathPresetById } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import AnimationPanel from './AnimationPanel.svelte';

/**
 * MotionPathRow tests, exercised THROUGH the docked AnimationPanel: the row is
 * only useful when it is wired to the panel's commit path, and mounting it in
 * isolation would prove the markup while leaving the wiring (the part that
 * broke in other bindings) untested.
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

function mountPanel(animations?: PptxElementAnimation[]): {
	editor: EditorState;
	select: HTMLSelectElement;
	target: HTMLElement;
} {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [shapeEl('shape-1')],
			animations,
		} as PptxSlide,
	]);
	editor.select('shape-1');

	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(AnimationPanel, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const select = target.querySelector<HTMLSelectElement>('.pptx-svelte-animp-motionpath');
	expect(select, 'the animation panel must render the motion-path row').not.toBeNull();
	return { editor, select: select!, target };
}

/**
 * The accessible name a label-text consumer computes for a form control: its
 * own `aria-label` if it has one, and otherwise the ENTIRE text of the `<label>`
 * wrapping it. That fallback is the defect this pins: with the control nested in
 * its label, the label's text is the caption plus every `<option>`, so the
 * picker answered to the name of any path in the catalogue.
 */
function accessibleName(control: Element): string {
	const own = control.getAttribute('aria-label');
	return (own ?? control.closest('label')?.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

function choose(select: HTMLSelectElement, value: string): void {
	select.value = value;
	select.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

describe('motionPathRow', () => {
	it('labels the row and offers the whole catalogue grouped by family', () => {
		const { select, target } = mountPanel();
		expect(target.textContent).toContain('Motion Path');
		expect(select.querySelector('option[value="none"]')?.textContent).toBe('No motion path');
		expect([...select.querySelectorAll('optgroup')].map((group) => group.label)).toStrictEqual([
			'Lines',
			'Arcs',
			'Turns',
			'Shapes',
			'Loops',
		]);
		// One option per preset, plus the leading "none" entry.
		expect(select.querySelectorAll('option')).toHaveLength(MOTION_PATH_PRESETS.length + 1);
	});

	it('names the select itself instead of borrowing the whole label', () => {
		const { select } = mountPanel([
			{ elementId: 'shape-1', motionPath: 'M 0 0 L 0.37 0.11' } as PptxElementAnimation,
		]);
		const name = accessibleName(select);

		expect(name).toBe('Motion Path');
		// The caption alone: not the option list, and not the drag hint that also
		// sits inside the same `<label>`.
		expect(name).not.toContain('No motion path');
		expect(name).not.toContain('Drag the end point');
	});

	it('hides the hint and the custom option until a path is applied', () => {
		const { select, target } = mountPanel();
		expect(select.querySelector('option[value="custom"]')).toBeNull();
		expect(target.textContent).not.toContain('Drag the end point');
		expect(select.value).toBe('none');
	});

	it('applies a catalogue preset onto the slide animations', () => {
		const { editor, select } = mountPanel();
		choose(select, 'arcDown');
		expect(editor.slides[0]?.animations?.[0]).toMatchObject({
			elementId: 'shape-1',
			motionPath: motionPathPresetById('arcDown')?.path,
		});
	});

	it('selects the matching preset and shows the edit hint for an applied path', () => {
		const { select, target } = mountPanel([
			{
				elementId: 'shape-1',
				motionPath: motionPathPresetById('lineRight')?.path,
				motionPathEditMode: 'relative',
			},
		]);
		expect(select.value).toBe('lineRight');
		expect(target.textContent).toContain('Drag the end point on the slide to retarget the path');
	});

	it('surfaces a hand-dragged path as a selected Custom Path option', () => {
		const { select } = mountPanel([
			{ elementId: 'shape-1', motionPath: 'M 0 0 L 0.31 0.07', motionPathEditMode: 'relative' },
		]);
		expect(select.querySelector('option[value="custom"]')?.textContent).toBe('Custom Path');
		expect(select.value).toBe('custom');
	});

	it('leaves a dragged path untouched when Custom Path is re-selected', () => {
		const path = 'M 0 0 L 0.31 0.07';
		const { editor, select } = mountPanel([
			{ elementId: 'shape-1', motionPath: path, motionPathEditMode: 'relative' },
		]);
		choose(select, 'custom');
		expect(editor.slides[0]?.animations?.[0]?.motionPath).toBe(path);
	});

	it('clears the path (and the now-empty entry) on No motion path', () => {
		const { editor, select } = mountPanel([
			{
				elementId: 'shape-1',
				motionPath: motionPathPresetById('lineRight')?.path,
				motionPathEditMode: 'relative',
			},
		]);
		choose(select, 'none');
		expect(editor.slides[0]?.animations ?? []).toHaveLength(0);
	});

	it('keeps a coexisting preset when only the path is cleared', () => {
		const { editor, select } = mountPanel([
			{
				elementId: 'shape-1',
				entrance: 'fadeIn',
				motionPath: motionPathPresetById('lineRight')?.path,
				motionPathEditMode: 'relative',
			},
		]);
		choose(select, 'none');
		expect(editor.slides[0]?.animations?.[0]).toMatchObject({
			elementId: 'shape-1',
			entrance: 'fadeIn',
			motionPath: undefined,
		});
	});

	it('is read-only when the deck is not editable', () => {
		const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
		editor.editable = false;
		editor.setSlides([
			{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [shapeEl('shape-1')] } as PptxSlide,
		]);
		editor.select('shape-1');
		const target = document.createElement('div');
		const instance = mount(AnimationPanel, { target, props: { editor } });
		flushSync();
		cleanup = () => unmount(instance);

		const select = target.querySelector<HTMLSelectElement>('.pptx-svelte-animp-motionpath');
		expect(select?.disabled).toBeTruthy();
	});
});
