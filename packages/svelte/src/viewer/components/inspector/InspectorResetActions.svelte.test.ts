import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import ChartSection from './ChartSection.svelte';
import ImageSection from './ImageSection.svelte';
import MediaSection from './MediaSection.svelte';
import SlideBackgroundSection from './SlideBackgroundSection.svelte';

/**
 * #398: the inspector reset and clear actions share one gating contract
 * (`inspector-reset-actions` in pptx-viewer-shared) across all five bindings.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function editorWith(element: PptxElement | undefined, slideExtra: object = {}): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([
		{ id: 's1', rId: 'rId1', slideNumber: 1, elements: element ? [element] : [], ...slideExtra },
	]);
	if (element) {
		editor.select(element.id);
	}
	return editor;
}

function render(component: never, props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component, { target, props });
	flushSync();
	cleanup = () => {
		void unmount(instance);
		target.remove();
	};
	return target;
}

const button = (target: HTMLElement, text: string): HTMLButtonElement | undefined =>
	[...target.querySelectorAll('button')].find(
		(b) => b.textContent?.trim() === text || b.title === text,
	);

const picture = (extra: object = {}): PptxElement =>
	({
		type: 'image',
		id: 'img1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		imagePath: 'a.png',
		...extra,
	}) as PptxElement;

describe('svelte inspector reset and clear actions', () => {
	it('reset Picture is disabled until an override exists', () => {
		const clean = picture();
		const target = render(ImageSection as never, { editor: editorWith(clean), el: clean });
		expect(button(target, 'Reset Picture')?.disabled).toBeTruthy();
	});

	it('reset Crop zeroes the insets and honours noCrop', () => {
		const el = picture({ cropLeft: 0.2, cropTop: 0.1 });
		const editor = editorWith(el);
		const target = render(ImageSection as never, { editor, el });
		button(target, 'Reset Crop')?.click();
		flushSync();
		const after = editor.slides[0]?.elements[0] as unknown as Record<string, number>;
		expect([after.cropLeft, after.cropTop, after.cropRight, after.cropBottom]).toStrictEqual([
			0, 0, 0, 0,
		]);

		cleanup?.();
		const locked = picture({ locks: { noCrop: true } });
		const lockedTarget = render(ImageSection as never, { editor: editorWith(locked), el: locked });
		expect(button(lockedTarget, 'Reset Crop')?.disabled).toBeTruthy();
	});

	it('reset trim exists only for trimmed media and zeroes both ends', () => {
		const media = (trimStartMs: number): PptxElement =>
			({
				type: 'media',
				id: 'm1',
				x: 0,
				y: 0,
				width: 10,
				height: 10,
				mediaType: 'video',
				trimStartMs,
			}) as unknown as PptxElement;
		const untrimmed = render(MediaSection as never, { editor: editorWith(media(0)) });
		expect(button(untrimmed, 'Reset trim')).toBeUndefined();
		cleanup?.();

		const editor = editorWith(media(500));
		const target = render(MediaSection as never, { editor });
		button(target, 'Reset trim')?.click();
		flushSync();
		const after = editor.slides[0]?.elements[0] as unknown as Record<string, number>;
		expect([after.trimStartMs, after.trimEndMs]).toStrictEqual([0, 0]);
	});

	it('clear series colour shows only for a coloured series and removes the colour', () => {
		const chart = {
			type: 'chart',
			id: 'c1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			chartData: {
				chartType: 'bar',
				categories: ['a'],
				series: [
					{ name: 'S1', values: [1], color: '#ff0000' },
					{ name: 'S2', values: [2] },
				],
			},
		} as unknown as PptxElement;
		const editor = editorWith(chart);
		const target = render(ChartSection as never, { editor });
		const clears = target.querySelectorAll('button.clear-series-color');
		expect(clears).toHaveLength(1);
		(clears[0] as HTMLButtonElement).click();
		flushSync();
		const element = editor.slides[0]?.elements[0] as unknown as {
			chartData: { series: { color?: string }[] };
		};
		expect(element.chartData.series[0].color).toBeUndefined();
	});

	it('clear Background is hidden without a background and clears every facet', () => {
		const empty = render(SlideBackgroundSection as never, { editor: editorWith(undefined) });
		expect(button(empty, 'Clear Background')).toBeUndefined();
		cleanup?.();

		const editor = editorWith(undefined, { backgroundColor: '#123456' });
		const target = render(SlideBackgroundSection as never, { editor });
		button(target, 'Clear Background')?.click();
		flushSync();
		expect(editor.slides[0]?.backgroundColor).toBeUndefined();
	});
});
