// @vitest-environment happy-dom
/**
 * `onSelectionChange` and `getSelectedElementIds` report a SINGLE selection
 * (#368): a plain click sets only `selectedElementId` -- the ids array is for
 * multi-selections -- so reporting the array alone missed the most common
 * selection entirely, and its clearing.
 */
import { PptxHandler } from 'pptx-viewer-core';
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';

import type { PowerPointViewerHandle } from '../types';
import { useViewerBuildingBlocks } from './useViewerBuildingBlocks';
import type { ViewerBuildingBlocksResult } from './useViewerBuildingBlocks';

let root: Root;
let container: HTMLDivElement;
let latest: ViewerBuildingBlocksResult;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
	true;
const handle = createRef<PowerPointViewerHandle>();
const onSelectionChange = vi.fn();

function Harness({ content }: { content: Uint8Array }) {
	latest = useViewerBuildingBlocks({
		content,
		canEdit: true,
		handle,
		autosave: false,
		onSelectionChange,
	});
	return <div />;
}

async function mount() {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	data.slides[0].elements = [
		{ id: 'title', type: 'text', x: 67, y: 40, width: 400, height: 60, text: 'Quarterly report' },
	];
	data.slides[0].isDirty = true;
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
}

afterEach(async () => {
	await act(async () => root?.unmount());
	container?.remove();
	onSelectionChange.mockClear();
});

const press = () =>
	({
		button: 0,
		shiftKey: false,
		metaKey: false,
		ctrlKey: false,
		clientX: 100,
		clientY: 60,
		stopPropagation: vi.fn(),
		preventDefault: vi.fn(),
	}) as unknown as React.MouseEvent;

test('a plain click reports the one selected element, and clearing reports none', async () => {
	await mount();
	await act(async () => {
		latest.canvasProps.onMouseDown('title', press());
		latest.canvasProps.onClick('title', press());
	});
	expect(onSelectionChange).toHaveBeenLastCalledWith(['title']);
	expect(handle.current!.getSelectedElementIds()).toStrictEqual(['title']);
	await act(async () => handle.current!.clearSelection());
	expect(onSelectionChange).toHaveBeenLastCalledWith([]);
	expect(handle.current!.getSelectedElementIds()).toStrictEqual([]);
});
