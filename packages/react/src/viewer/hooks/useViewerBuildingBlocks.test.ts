import { PptxHandler } from 'pptx-viewer-core';
// @vitest-environment happy-dom
/**
 * Live sanity check for `useViewerBuildingBlocks`: renders a component that
 * calls the hook with a real, minimal PPTX buffer (built via
 * `PptxHandler.create()` + `handler.save()`, the same helper the core
 * package's own round-trip tests use) and asserts the returned
 * `toolbarProps` / `canvasProps` come back with sane shapes once the file
 * has finished loading.
 *
 * No `@testing-library/react` is available in this workspace, so this
 * follows the same manual `createRoot` + `act` harness pattern used by
 * `CollaborationProvider.remount.test.tsx`.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { useViewerBuildingBlocks } from './useViewerBuildingBlocks';
import type { ViewerBuildingBlocksResult } from './useViewerBuildingBlocks';

let fixtureBytes: Uint8Array;

beforeAll(async () => {
	const { handler, data } = await PptxHandler.create({
		title: 'Building Blocks Fixture',
		initialSlideCount: 1,
	});
	fixtureBytes = await handler.save(data.slides);
});

let container: HTMLDivElement;
let root: Root;
let latest: ViewerBuildingBlocksResult | null = null;

function Harness({ content }: { content: Uint8Array }): React.ReactElement {
	const result = useViewerBuildingBlocks({ content, canEdit: true });
	latest = result;
	return React.createElement('div', { 'data-testid': 'harness' });
}

/** Flush one macrotask tick inside `act` so pending promise chains settle. */
async function flush(): Promise<void> {
	await act(async () => {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});
	});
}

/**
 * Poll `flush()` until `isDone()` reports true or `timeoutMs` of wall-clock
 * time elapses. A fixed attempt count is too tight on a slow/contended CI
 * runner, where each macrotask tick can take far longer than it does
 * locally; a real deadline scales with however long the runner actually
 * needs instead of assuming a fixed number of ticks is "enough".
 */
async function flushUntil(isDone: () => boolean, timeoutMs = 10_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!isDone() && Date.now() < deadline) {
		await flush();
	}
}

beforeEach(() => {
	latest = null;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

describe('useViewerBuildingBlocks', () => {
	it('loads a real PPTX buffer and produces working toolbar/canvas props', async () => {
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes }));
		});

		// The content-load effect runs a multi-await async chain (handler.load,
		// media/image resolution, then the state setters); poll a few flushes
		// rather than assuming a single tick settles it.
		await flushUntil(() => latest?.loading === false);

		expect(latest).not.toBeNull();
		expect(latest?.loading).toBeFalsy();
		expect(latest?.error).toBeNull();
		expect(latest?.mode).toBe('edit');
		expect(latest?.autosaveStatus).toBeDefined();

		// ── toolbarProps: sane shape, matches the loaded document ──────────
		const { toolbarProps } = latest as ViewerBuildingBlocksResult;
		expect(toolbarProps.mode).toBe('edit');
		expect(toolbarProps.canEdit).toBeTruthy();
		expect(toolbarProps.onUndo).toBeTypeOf('function');
		expect(toolbarProps.onAddTextBox).toBeTypeOf('function');
		expect(toolbarProps.onSaveAsPptx).toBeTypeOf('function');
		expect(toolbarProps.canUndo).toBeFalsy();
		expect(toolbarProps.canRedo).toBeFalsy();

		// ── canvasProps: the fixture's one slide made it through the loader ──
		const { canvasProps } = latest as ViewerBuildingBlocksResult;
		expect(canvasProps.mode).toBe('edit');
		expect(canvasProps.canEdit).toBeTruthy();
		expect(canvasProps.activeSlide).toBeDefined();
		expect(Array.isArray(canvasProps.activeSlide?.elements)).toBeTruthy();
		expect(canvasProps.canvasSize.width).toBeGreaterThan(0);
		expect(canvasProps.canvasSize.height).toBeGreaterThan(0);
		expect(canvasProps.onClick).toBeTypeOf('function');
		expect(canvasProps.onInlineEditChange).toBeTypeOf('function');
	}, 15_000);

	it('starts in a loading state before the buffer resolves', async () => {
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes }));
		});

		// Immediately after the first render (before any flush), the async
		// load effect has been scheduled but not yet resolved.
		expect(latest?.loading).toBeTruthy();
		expect(latest?.canvasProps.activeSlide).toBeUndefined();

		await flushUntil(() => latest?.loading === false);
		expect(latest?.loading).toBeFalsy();
	}, 15_000);
});
