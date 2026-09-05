import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../editor/editor-state.svelte';
import ShapeFormatGroup from './ShapeFormatGroup.svelte';

/**
 * The ribbon's Shape Fill / Shape Outline pickers show the deck's real
 * "Theme Colors" grid above the standard swatch row (React `ShapeColorPopover`
 * / Vue `DrawingGroup.vue` parity). A theme swatch commits both the resolved
 * hex and its `PptxThemeColorRef` (via the shared `shapeFillChange` /
 * `shapeOutlineChange` decision functions); a standard/custom pick clears
 * the ref.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeEl(): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#ff0000', strokeColor: '#0000ff' },
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
		fillColor?: string;
		fillColorRef?: { scheme: string };
		strokeColor?: string;
		strokeColorRef?: { scheme: string };
		fillMode?: string;
	};
};

function mountGroup(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ShapeFormatGroup, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('shapeFormatGroup theme colour', () => {
	it('clicking the fill trigger then a theme swatch commits hex + ref and forces solid fill', () => {
		const editor = makeEditor(shapeEl());
		const target = mountGroup(editor);

		const trigger = target.querySelector<HTMLButtonElement>(
			'.pptx-svelte-swatch-trigger[aria-label="Shape Fill"]',
		);
		expect(trigger).not.toBeNull();
		trigger?.click();
		flushSync();

		const swatch = target.querySelector<HTMLButtonElement>('button[title="Accent 2"]');
		expect(swatch).not.toBeNull();
		swatch?.click();
		flushSync();

		const style = (currentEl(editor) as ShapeStyleShape).shapeStyle;
		expect(style?.fillColor).toBe('#ed7d31');
		expect(style?.fillColorRef).toStrictEqual({ scheme: 'accent2' });
		expect(style?.fillMode).toBe('solid');
	});

	it('clicking the outline trigger then a theme swatch commits hex + ref', () => {
		const editor = makeEditor(shapeEl());
		const target = mountGroup(editor);

		const trigger = target.querySelector<HTMLButtonElement>(
			'.pptx-svelte-swatch-trigger[aria-label="Shape Outline"]',
		);
		expect(trigger).not.toBeNull();
		trigger?.click();
		flushSync();

		const swatch = target.querySelector<HTMLButtonElement>('button[title="Accent 2"]');
		expect(swatch).not.toBeNull();
		swatch?.click();
		flushSync();

		const style = (currentEl(editor) as ShapeStyleShape).shapeStyle;
		expect(style?.strokeColor).toBe('#ed7d31');
		expect(style?.strokeColorRef).toStrictEqual({ scheme: 'accent2' });
	});

	it('a standard swatch pick clears a previously-set fillColorRef', () => {
		const editor = makeEditor(shapeEl());
		const target = mountGroup(editor);

		const trigger = target.querySelector<HTMLButtonElement>(
			'.pptx-svelte-swatch-trigger[aria-label="Shape Fill"]',
		);
		trigger?.click();
		flushSync();
		target.querySelector<HTMLButtonElement>('button[title="Accent 2"]')?.click();
		flushSync();
		expect((currentEl(editor) as ShapeStyleShape).shapeStyle?.fillColorRef).toStrictEqual({
			scheme: 'accent2',
		});

		trigger?.click();
		flushSync();
		const standardSwatch = target.querySelector<HTMLButtonElement>(
			'.pptx-svelte-swatch-grid .pptx-svelte-swatch-cell',
		);
		expect(standardSwatch).not.toBeNull();
		standardSwatch?.click();
		flushSync();

		const style = (currentEl(editor) as ShapeStyleShape).shapeStyle;
		expect(style?.fillColorRef).toBeUndefined();
	});
});
