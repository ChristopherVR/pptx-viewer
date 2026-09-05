// @vitest-environment happy-dom
/**
 * The elected-writer (`role: 'owner'`) write-back scheduler used to call
 * `handler.save(slidesToSave)` with NO options, so an owner's write-back file
 * silently dropped every session-level edit outside `slides` (table style
 * edits, view toggles, tags, deck properties, ...). This asserts the new
 * `getSaveOptions` dep reaches the `handler.save(...)` call.
 */
import type { PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig, YDocLike, YjsFactories } from 'pptx-viewer-shared';
import { reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

const loadMock = vi.fn().mockResolvedValue({});
const saveMock = vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));

vi.mock(import('pptx-viewer-core'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		PptxHandler: vi.fn().mockImplementation(function PptxHandlerMock(this: object) {
			Object.assign(this, { load: loadMock, save: saveMock });
		}),
	};
});

const { useYjsDocumentSync } = await import('./useYjsDocumentSync');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	vi.clearAllMocks();
	loadMock.mockResolvedValue({});
	saveMock.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
	vi.useFakeTimers();
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
	vi.useRealTimers();
});

function makeSlide(id: string): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [] } as PptxSlide;
}

const factories: YjsFactories = {
	createMap: () => new Y.Map() as unknown as ReturnType<YjsFactories['createMap']>,
	createArray: () => new Y.Array() as unknown as ReturnType<YjsFactories['createArray']>,
	createText: () => new Y.Text() as unknown as ReturnType<YjsFactories['createText']>,
};

describe('useYjsDocumentSync write-back getSaveOptions wiring', () => {
	it('passes getSaveOptions() through to handler.save on write-back', async () => {
		const doc = new Y.Doc();
		reconcileSlidesInYDoc([makeSlide('s1')], doc as unknown as YDocLike, factories);
		const onWriteBack = vi.fn();
		const saveOptions: PptxHandlerSaveOptions = { viewProperties: { showComments: true } };

		function Probe(): null {
			useYjsDocumentSync({
				doc,
				slides: [makeSlide('s1')],
				templateElementsBySlideId: {},
				setSlides: () => {},
				isConnected: true,
				isSynced: true,
				config: {
					role: 'owner',
					onWriteBack,
					writeBackDebounceMs: 0,
				} as CollaborationConfig,
				getSourceBytes: () => new Uint8Array([1, 2, 3]),
				getSaveOptions: () => saveOptions,
			});
			return null;
		}

		await act(async () => {
			root.render(<Probe />);
		});

		// A local -> Y.Doc reconcile inside the same render does not itself fire
		// the remote-observer write-back trigger; mutate the doc directly (as a
		// remote peer would) to exercise the observer path the scheduler hooks.
		await act(async () => {
			doc.transact(() => {
				const arr = doc.getArray('pptx:slides');
				const map = arr.get(0) as Y.Map<unknown>;
				map.set('slideNumber', 2);
			}, 'remote-peer');
			await vi.runAllTimersAsync();
		});

		expect(saveMock).toHaveBeenCalledWith(expect.anything(), saveOptions);
	});
});
