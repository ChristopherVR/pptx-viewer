import type { PptxElement } from 'pptx-viewer-core';
import type { Component } from 'svelte';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { FindReplaceState } from '../editor/editor-find-replace.svelte';
import { EditorState } from '../editor/editor-state.svelte';
import CropOverlay from './CropOverlay.svelte';
import CropControls from './ribbon/home/CropControls.svelte';
import HomeTab from './ribbon/home/HomeTab.svelte';
import MergeShapesButton from './ribbon/home/MergeShapesButton.svelte';

/**
 * The Merge Shapes and Crop ribbon controls and the on-canvas crop overlay,
 * mounted against a real `EditorState`.
 */

let cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups) {
		cleanup();
	}
	cleanups = [];
});

const RECT: PptxElement = {
	type: 'shape',
	id: 'a',
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	shapeType: 'rect',
};
const ELLIPSE: PptxElement = {
	type: 'shape',
	id: 'b',
	x: 50,
	y: 50,
	width: 100,
	height: 100,
	shapeType: 'ellipse',
};
const PICTURE = {
	type: 'picture',
	id: 'pic',
	x: 200,
	y: 100,
	width: 200,
	height: 100,
	imageData: 'data:image/png;base64,AAAA',
} as PptxElement;

function makeEditor(elements: PptxElement[]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements }]);
	return editor;
}

function render<P extends Record<string, unknown>>(component: Component<P>, props: P): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component, { target, props });
	flushSync();
	cleanups.push(() => {
		unmount(instance);
		target.remove();
	});
	return target;
}

function control(target: HTMLElement, id: string): HTMLButtonElement {
	const node = target.querySelector<HTMLButtonElement>(`[data-pptx-ribbon-control="${id}"]`);
	if (!node) {
		throw new Error(`missing ribbon control ${id}`);
	}
	return node;
}

describe('merge shapes ribbon button', () => {
	it('is disabled with the hint until two mergeable shapes are selected', () => {
		const editor = makeEditor([RECT, ELLIPSE]);
		editor.selection.set('a');
		const target = render(MergeShapesButton, { editor });

		const button = control(target, 'merge-shapes');
		expect(button.disabled).toBeTruthy();
		expect(button.title).toBe('Select two or more shapes to merge them');

		editor.selection.setAll(['a', 'b']);
		flushSync();
		expect(button.disabled).toBeFalsy();
		expect(button.getAttribute('aria-label')).toBe('Merge Shapes');
	});

	it('lists five operations and replaces the two shapes with one custom shape', () => {
		const editor = makeEditor([RECT, ELLIPSE]);
		editor.selection.setAll(['a', 'b']);
		const target = render(MergeShapesButton, { editor });

		control(target, 'merge-shapes').click();
		flushSync();
		const items = [...target.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
		expect(items.map((item) => item.dataset.pptxMergeOp)).toStrictEqual([
			'union',
			'combine',
			'fragment',
			'intersect',
			'subtract',
		]);
		items[0].click();
		flushSync();

		expect(editor.activeElements).toHaveLength(1);
		const merged = editor.activeElements[0];
		expect(merged.type === 'shape' && merged.pathData).toBeTruthy();
	});
});

describe('crop ribbon controls', () => {
	it('toggles crop mode on a selected picture and is disabled for a shape', () => {
		const editor = makeEditor([PICTURE, RECT]);
		editor.selection.set('a');
		const target = render(CropControls, { editor });
		const crop = control(target, 'crop');
		expect(crop.disabled).toBeTruthy();
		expect(crop.title).toBe('Select a picture to crop it');

		editor.selection.set('pic');
		flushSync();
		crop.click();
		flushSync();
		expect(editor.cropOps.active).toBeTruthy();
		expect(crop.getAttribute('aria-pressed')).toBe('true');
	});

	it('applies a 1:1 aspect preset as one undoable update', () => {
		const editor = makeEditor([PICTURE]);
		editor.selection.set('pic');
		const target = render(CropControls, { editor });

		control(target, 'crop-menu').click();
		flushSync();
		target.querySelector<HTMLButtonElement>('[data-pptx-crop-aspect="1:1"]')?.click();
		flushSync();

		const pic = editor.elementById('pic');
		expect(pic?.width).toBeCloseTo(100);
		expect(pic?.height).toBeCloseTo(100);
		editor.undo();
		expect(editor.elementById('pic')?.width).toBe(200);
	});
});

describe('crop overlay', () => {
	function enterCrop(): { editor: EditorState; target: HTMLElement } {
		const editor = makeEditor([PICTURE]);
		editor.selection.set('pic');
		editor.cropOps.enter();
		const target = render(CropOverlay, { editor, scale: 1, mediaDataUrls: new Map() });
		return { editor, target };
	}

	it('renders the ghost, the frame and eight handles', () => {
		const { target } = enterCrop();

		expect(target.querySelector('[data-pptx-crop-overlay="true"]')).not.toBeNull();
		expect(target.querySelector('[data-pptx-crop-frame]')).not.toBeNull();
		const handles = [...target.querySelectorAll('[data-pptx-crop-handle]')];
		expect(handles.map((node) => node.getAttribute('data-pptx-crop-handle'))).toStrictEqual([
			'nw',
			'n',
			'ne',
			'e',
			'se',
			's',
			'sw',
			'w',
		]);
		expect(handles[0].getAttribute('aria-label')).toBe('Crop handle');
	});

	it('a left-handle drag crops the picture live', () => {
		const { editor, target } = enterCrop();
		const west = target.querySelector<HTMLElement>('[data-pptx-crop-handle="w"]');

		west?.dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }),
		);
		window.dispatchEvent(new PointerEvent('pointermove', { clientX: 40, clientY: 0 }));
		window.dispatchEvent(new PointerEvent('pointerup', { clientX: 40, clientY: 0 }));
		flushSync();

		const pic = editor.elementById('pic');
		expect(pic?.x).toBeCloseTo(240);
		expect(pic?.cropLeft).toBeCloseTo(0.2);
		expect(editor.canUndo).toBeFalsy();
	});
});

describe('home tab customisation', () => {
	function mountHome(hiddenActions?: Array<'mergeShapes' | 'crop'>): HTMLElement {
		const editor = makeEditor([RECT]);
		const findReplace = new FindReplaceState({
			getSlides: () => editor.slides,
			commitSlides: () => {},
		});
		return render(HomeTab, { editor, findReplace, onnavigateslide: () => {}, hiddenActions });
	}

	it('shows Merge Shapes and Crop in the Arrange group by default', () => {
		const target = mountHome();

		expect(target.querySelector('[data-pptx-ribbon-control="merge-shapes"]')).not.toBeNull();
		expect(target.querySelector('[data-pptx-ribbon-control="crop"]')).not.toBeNull();
	});

	it('drops both controls when the host hides them', () => {
		const target = mountHome(['mergeShapes', 'crop']);

		expect(target.querySelector('[data-pptx-ribbon-control="merge-shapes"]')).toBeNull();
		expect(target.querySelector('[data-pptx-ribbon-control="crop"]')).toBeNull();
		expect(target.querySelector('[data-pptx-ribbon-control="crop-menu"]')).toBeNull();
	});
});
