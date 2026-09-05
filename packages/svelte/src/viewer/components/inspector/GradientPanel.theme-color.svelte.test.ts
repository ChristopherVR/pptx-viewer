import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import GradientPanel from './GradientPanel.svelte';

/**
 * Gradient stop colour: each stop shows the deck's real "Theme Colors" grid
 * below its native colour input (React/Vue `GradientStopRow` parity). A
 * theme swatch commits both the resolved hex and its `PptxThemeColorRef`;
 * the native colour input always clears the ref.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function gradientShapeEl(): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: {
			fillMode: 'gradient',
			fillGradientType: 'linear',
			fillGradientAngle: 90,
			fillGradientStops: [
				{ color: '#111111', position: 0 },
				{ color: '#eeeeee', position: 100 },
			],
		},
	} as PptxElement;
}

function makeEditor(el: PptxElement): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [el] }]);
	editor.select(el.id);
	editor.theme = {
		colorScheme: {
			dk1: '#000000',
			lt1: '#ffffff',
			dk2: '#44546a',
			lt2: '#e7e6e6',
			accent1: '#4472c4',
			accent2: '#ed7d31',
			accent3: '#a5a5a5',
			accent4: '#ffc000',
			accent5: '#5b9bd5',
			accent6: '#70ad47',
			hlink: '#0563c1',
			folHlink: '#954f72',
		},
	};
	return editor;
}

function currentEl(editor: EditorState): PptxElement {
	const el = editor.slides[0]?.elements[0];
	if (!el) {
		throw new Error('element missing');
	}
	return el;
}

type ShapeStyleShape = {
	shapeStyle?: {
		fillGradientStops?: Array<{ color: string; position: number; colorRef?: { scheme: string } }>;
	};
};

function stops(
	editor: EditorState,
): NonNullable<NonNullable<ShapeStyleShape['shapeStyle']>['fillGradientStops']> {
	const list = (currentEl(editor) as ShapeStyleShape).shapeStyle?.fillGradientStops;
	if (!list) {
		throw new Error('gradient stops missing');
	}
	return list;
}

function mountPanel(editor: EditorState, el: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(GradientPanel, { target, props: { editor, el } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('gradientPanel theme colour', () => {
	it('clicking a theme swatch on a stop commits both the hex and the ref', () => {
		const editor = makeEditor(gradientShapeEl());
		const target = mountPanel(editor, currentEl(editor));

		const stopGroups = target.querySelectorAll('.pptx-svelte-gradient-stop-group');
		expect(stopGroups).toHaveLength(2);
		const firstStopSwatch = stopGroups[0]?.querySelector<HTMLButtonElement>(
			'button[title="Accent 2"]',
		);
		expect(firstStopSwatch).not.toBeNull();
		firstStopSwatch?.click();
		flushSync();

		const stop = stops(editor)[0];
		expect(stop?.color).toBe('#ed7d31');
		expect(stop?.colorRef).toStrictEqual({ scheme: 'accent2' });
	});

	it('the native colour input clears a previously-set colorRef', () => {
		const editor = makeEditor(gradientShapeEl());
		const target = mountPanel(editor, currentEl(editor));

		const stopGroups = target.querySelectorAll('.pptx-svelte-gradient-stop-group');
		const firstStopSwatch = stopGroups[0]?.querySelector<HTMLButtonElement>(
			'button[title="Accent 2"]',
		);
		firstStopSwatch?.click();
		flushSync();
		expect(stops(editor)[0]?.colorRef).toStrictEqual({ scheme: 'accent2' });

		const colorInput = stopGroups[0]?.querySelector<HTMLInputElement>('input[type="color"]');
		expect(colorInput).not.toBeNull();
		if (colorInput) {
			colorInput.value = '#654321';
			colorInput.dispatchEvent(new Event('change', { bubbles: true }));
		}
		flushSync();

		const stop = stops(editor)[0];
		expect(stop?.color).toBe('#654321');
		expect(stop?.colorRef).toBeUndefined();
	});
});
