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
import { Awareness } from 'y-protocols/awareness';
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
const { useCollaborationWriteBack } = await import('./useCollaborationWriteBack');

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
	it.each(['pending', 'in-flight'])(
		'keeps %s snapshot work when the host replaces an inline callback',
		async (stage) => {
			const doc = new Y.Doc();
			reconcileSlidesInYDoc([makeSlide('s1')], doc, factories);
			const first = vi.fn();
			const latest = vi.fn();
			let schedule!: () => void;
			let finishSave!: (bytes: Uint8Array) => void;
			if (stage === 'in-flight') {
				saveMock.mockReturnValue(
					new Promise((resolve) => {
						finishSave = resolve;
					}),
				);
			}
			function Probe({ onWriteBack }: { onWriteBack: (bytes: Uint8Array) => void }): null {
				schedule = useCollaborationWriteBack({
					doc,
					config: { role: 'owner', onWriteBack, writeBackDebounceMs: 100 },
					isSynced: true,
					getSourceBytes: () => new Uint8Array([1, 2, 3]),
					templateElementsBySlideId: {},
				});
				return null;
			}
			try {
				await act(async () => root.render(<Probe onWriteBack={first} />));
				schedule();
				if (stage === 'in-flight') {
					await act(async () => vi.advanceTimersByTimeAsync(100));
					expect(saveMock).toHaveBeenCalledOnce();
				}
				await act(async () => root.render(<Probe onWriteBack={latest} />));
				await act(async () => {
					if (stage === 'in-flight') {
						finishSave(new Uint8Array([4]));
					}
					await vi.runAllTimersAsync();
				});
				expect(first).not.toHaveBeenCalled();
				expect(latest).toHaveBeenCalledOnce();
			} finally {
				doc.destroy();
			}
		},
	);

	it.each(['callback', 'role', 'document', 'session', 'unmount'] as const)(
		'cancels in-flight snapshot work on %s removal or replacement',
		async (change) => {
			const firstDoc = new Y.Doc();
			const nextDoc = new Y.Doc();
			const awareness = new Awareness(firstDoc);
			const onWriteBack = vi.fn();
			const externalSession = {
				doc: firstDoc,
				awareness,
				getSnapshot: () => ({ status: 'connected' as const, synced: true }),
				subscribe: () => () => {},
			};
			let config: Pick<
				CollaborationConfig,
				'role' | 'onWriteBack' | 'writeBackDebounceMs' | 'externalSession'
			> = {
				role: 'owner',
				onWriteBack,
				writeBackDebounceMs: 0,
				externalSession,
			};
			let currentDoc = firstDoc;
			let schedule!: () => void;
			let finishSave!: (bytes: Uint8Array) => void;
			saveMock.mockReturnValue(
				new Promise((resolve) => {
					finishSave = resolve;
				}),
			);
			function Probe(): null {
				schedule = useCollaborationWriteBack({
					doc: currentDoc,
					config,
					isSynced: true,
					getSourceBytes: () => new Uint8Array([1]),
					templateElementsBySlideId: {},
				});
				return null;
			}
			try {
				await act(async () => root.render(<Probe />));
				schedule();
				await act(async () => vi.advanceTimersByTimeAsync(0));
				expect(saveMock).toHaveBeenCalledOnce();
				if (change === 'callback') {
					config = { ...config, onWriteBack: undefined };
				} else if (change === 'role') {
					config = { ...config, role: 'viewer' };
				} else if (change === 'document') {
					currentDoc = nextDoc;
				} else if (change === 'session') {
					config = { ...config, externalSession: { ...externalSession } };
				}
				await act(async () => root.render(change === 'unmount' ? null : <Probe />));
				await act(async () => finishSave(new Uint8Array([2])));
				expect(onWriteBack).not.toHaveBeenCalled();
			} finally {
				awareness.destroy();
				firstDoc.destroy();
				nextDoc.destroy();
			}
		},
	);

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
