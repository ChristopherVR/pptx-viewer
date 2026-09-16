// @vitest-environment happy-dom
import { PptxHandler } from 'pptx-viewer-core';
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, expect, test } from 'vitest';

import type { PowerPointViewerHandle } from '../types';
import { useViewerBuildingBlocks } from './useViewerBuildingBlocks';
import type { ViewerBuildingBlocksResult } from './useViewerBuildingBlocks';

let root: Root;
let container: HTMLDivElement;
let latest: ViewerBuildingBlocksResult;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
	true;
const handle = createRef<PowerPointViewerHandle>();

function Harness({ content }: { content: Uint8Array }) {
	latest = useViewerBuildingBlocks({ content, canEdit: true, handle, autosave: false });
	return <div />;
}

async function mount() {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 2 });
	data.slides.forEach((slide, index) => {
		slide.elements = [
			{
				id: `title-${index}`,
				type: 'text',
				x: 67,
				y: 40,
				width: 400,
				height: 60,
				text: `Quarterly report ${index + 1}`,
			},
		];
		slide.isDirty = true;
	});
	const content = await handler.save(data.slides);
	handler.dispose();
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root.render(<Harness content={content} />));
	const deadline = Date.now() + 10000;
	while (latest.loading && Date.now() < deadline) {
		await act(async () => {
			await new Promise<void>((resolve) => {
				setTimeout(resolve, 0);
			});
		});
	}
	expect(latest.error).toBeNull();
	expect(latest.loading).toBeFalsy();
	return handle.current!;
}

afterEach(async () => {
	await act(async () => root?.unmount());
	container?.remove();
});

test('reproduces separate undo steps when adjusting titles through the existing API', async () => {
	await mount();
	const [first, second] = handle.current!.getSlides().map((s) => s.elements[0].id);
	const positions = () => handle.current!.getSlides().map((s) => s.elements[0].x);
	expect(positions()).toStrictEqual([67, 67]);
	await act(async () => handle.current!.updateElement(first, { x: 84 }));
	await act(async () => handle.current!.goTo(1));
	await act(async () => handle.current!.updateElement(second, { x: 90 }));
	expect(positions()).toStrictEqual([84, 90]);
	await act(async () => handle.current!.undo());
	expect(positions()).toStrictEqual([84, 67]);
}, 20000);

function batch(x: number, y: number) {
	return handle.current!.getSlides().map((slide, index) => ({
		slideId: slide.id,
		elementId: slide.elements[0].id,
		patch: { x: index ? y : x },
	}));
}
const positions = () => handle.current!.getSlides().map((s) => s.elements[0].x);
async function undo() {
	await act(async () => handle.current!.undo());
	await act(async () => {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});
	});
}

test('commits a cross-slide batch, preserves the viewport and selection, and undoes/redoes it once', async () => {
	await mount();
	const selected = handle.current!.getElements()[0].id;
	await act(async () => handle.current!.selectElements([selected]));
	await act(async () => handle.current!.updateElements(batch(84, 90), { label: 'Adjust titles' }));
	expect(positions()).toStrictEqual([84, 90]);
	expect(handle.current!.getActiveSlideIndex()).toBe(0);
	expect(handle.current!.getSelectedElementIds()).toStrictEqual([selected]);
	await undo();
	expect(positions()).toStrictEqual([67, 67]);
	expect(handle.current!.canUndo()).toBeFalsy();
	await act(async () => handle.current!.redo());
	expect(positions()).toStrictEqual([84, 90]);
	expect(handle.current!.canRedo()).toBeFalsy();
}, 20000);

test('keeps consecutive batches independent even when called before React renders', async () => {
	await mount();
	const first = batch(84, 90),
		second = batch(100, 110);
	await act(async () => {
		await Promise.all([
			handle.current!.updateElements(first),
			handle.current!.updateElements(second),
		]);
	});
	expect(positions()).toStrictEqual([100, 110]);
	await undo();
	expect(positions()).toStrictEqual([84, 90]);
	await undo();
	expect(positions()).toStrictEqual([67, 67]);
	expect(handle.current!.canUndo()).toBeFalsy();
}, 20000);

test('keeps ordinary edits immediately before and after a batch independent', async () => {
	await mount();
	const id = handle.current!.getElements()[0].id;
	await act(async () => {
		handle.current!.updateElement(id, { x: 70 });
		await handle.current!.updateElements(batch(84, 90));
		handle.current!.updateElement(id, { x: 100 });
	});
	expect(positions()).toStrictEqual([100, 90]);
	await undo();
	expect(positions()).toStrictEqual([84, 90]);
	await undo();
	expect(positions()).toStrictEqual([70, 67]);
	await undo();
	expect(positions()).toStrictEqual([67, 67]);
}, 20000);

test('leaves state and redo history intact for failed and unchanged batches', async () => {
	await mount();
	await act(async () => handle.current!.updateElements(batch(84, 90)));
	await undo();
	await act(async () => {
		await handle.current!.updateElements([]);
		await handle.current!.updateElements(batch(67, 67));
		const invalid = batch(84, 90);
		invalid[1].elementId = 'missing';
		await expect(handle.current!.updateElements(invalid)).rejects.toThrow();
	});
	expect(positions()).toStrictEqual([67, 67]);
	expect(handle.current!.canUndo()).toBeFalsy();
	expect(handle.current!.canRedo()).toBeTruthy();
}, 20000);
