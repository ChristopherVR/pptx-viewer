import JSZip from 'jszip';
import { createImageElement, PptxHandler } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { createViewerOptionsStore, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import type { CollaborationConfig, ExternalCollaborationSession } from 'pptx-viewer-shared';
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
import React, { act, createRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import * as imageInsertion from '../../../../shared/src/render/image-file-insertion';
import { SlideCanvas } from '../components/SlideCanvas';
import type { SlideCanvasProps } from '../components/SlideCanvas';
import type { PowerPointViewerHandle } from '../types';
import type { UseAutosaveInput } from './useAutosave';
import { useViewerBuildingBlocks } from './useViewerBuildingBlocks';
import type { ViewerBuildingBlocksResult } from './useViewerBuildingBlocks';

let fixtureBytes: Uint8Array;
let twoSlideFixtureBytes: Uint8Array;
let embeddedFixtureBytes: Uint8Array;
let textEditingFixtureBytes: Uint8Array;
let readOnlyFixtureBytes: Uint8Array;

const { autosaveInputs } = vi.hoisted(() => ({ autosaveInputs: [] as UseAutosaveInput[] }));

// Expose the dirty gate that the real building-block composition hands to
// autosave; every other hook in the chain remains production code.
// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock(import('./useAutosave'), () => ({
	useAutosave: (input: UseAutosaveInput) => {
		autosaveInputs.push(input);
		return { autosaveStatus: { state: 'idle' as const }, triggerAutosave: async () => {} };
	},
}));

beforeAll(async () => {
	const oneSlide = await PptxHandler.create({
		title: 'Building Blocks Fixture',
		initialSlideCount: 1,
	});
	fixtureBytes = await oneSlide.handler.save(oneSlide.data.slides);
	readOnlyFixtureBytes = await oneSlide.handler.save(oneSlide.data.slides, {
		customProperties: [{ name: '_MarkAsFinal', value: 'true', type: 'bool' }],
	});
	// Match core's embedded-font-list round-trip fixture: a minimal sfnt header
	// in a GUID-named part that the loader recognizes as an embedded font.
	const rawFontData = new Uint8Array(64);
	rawFontData.set([0, 1, 0, 0]);
	embeddedFixtureBytes = await oneSlide.handler.save(oneSlide.data.slides, {
		embeddedFonts: [{ name: 'Sample Font', dataUrl: '', rawFontData, format: 'truetype' }],
	});
	oneSlide.data.slides[0].elements = ['First body', 'Second body'].map((text, index) => ({
		id: `text-${index}`,
		type: 'text',
		text,
		x: 20,
		y: 20 + index * 100,
		width: 250,
		height: 80,
		textStyle: { fontSize: 24 },
	}));
	oneSlide.data.slides[0].isDirty = true;
	textEditingFixtureBytes = await oneSlide.handler.save(oneSlide.data.slides);
	oneSlide.handler.dispose();

	const twoSlides = await PptxHandler.create({
		title: 'Two Slide Building Blocks Fixture',
		initialSlideCount: 2,
	});
	twoSlideFixtureBytes = await twoSlides.handler.save(twoSlides.data.slides);
	twoSlides.handler.dispose();
});

let container: HTMLDivElement;
let root: Root;
let latest: ViewerBuildingBlocksResult | null = null;

function Harness({
	collaboration,
	content,
	handle,
	onDirtyChange,
	canEdit = true,
	fitPadding,
	maxFitScale,
	measuredViewport,
	mountedCanvas,
}: {
	collaboration?: CollaborationConfig;
	content: Uint8Array | null;
	handle?: React.RefObject<PowerPointViewerHandle | null>;
	onDirtyChange?: (dirty: boolean) => void;
	canEdit?: boolean;
	fitPadding?: number;
	maxFitScale?: number | null;
	measuredViewport?: { width: number; height: number };
	mountedCanvas?: { key: string; overrides?: Partial<SlideCanvasProps> };
}): React.ReactElement {
	const result = useViewerBuildingBlocks({
		collaboration,
		content,
		canEdit,
		handle,
		onDirtyChange,
		fitPadding,
		maxFitScale,
	});
	latest = result;
	if (mountedCanvas) {
		return React.createElement(SlideCanvas, {
			...result.canvasProps,
			...mountedCanvas.overrides,
			key: mountedCanvas.key,
		});
	}
	return React.createElement('div', {
		'data-testid': 'harness',
		ref: (node: HTMLDivElement | null) => {
			if (measuredViewport) {
				result.canvasProps.zoom.canvasViewportRef.current = node;
				if (node) {
					Object.defineProperties(node, {
						clientWidth: { configurable: true, value: measuredViewport.width },
						clientHeight: { configurable: true, value: measuredViewport.height },
					});
				}
			}
		},
	});
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
	autosaveInputs.length = 0;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

function latestAutosaveDirty(): boolean {
	const input = autosaveInputs.at(-1);
	if (!input) {
		throw new Error('the composition never called useAutosave');
	}
	return input.isDirty;
}

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	vi.unstubAllGlobals();
});

describe('useViewerBuildingBlocks', () => {
	it('keeps the first built-in collaborative render read-only until session setup', async () => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		const editableRenders: boolean[] = [];
		function InitialSession(): React.ReactElement {
			const result = useViewerBuildingBlocks({
				content: null,
				canEdit: true,
				collaboration: { roomId: 'initial-custom-shell', serverUrl: '', userName: 'Host' },
			});
			editableRenders.push(result.canvasProps.canEdit);
			return React.createElement('div');
		}
		await act(async () => root.render(React.createElement(InitialSession)));
		expect(editableRenders[0]).toBe(false);
	});

	it('keeps a blank collaborative shell gated by live readiness and host permission', async () => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		const doc = new Y.Doc();
		const awareness = new Awareness(doc);
		const listeners = new Set<() => void>();
		let synced = false;
		const collaboration: CollaborationConfig = {
			roomId: 'blank-custom-shell',
			serverUrl: '',
			userName: 'Host',
			sessionIntent: 'create',
			externalSession: {
				doc,
				awareness,
				getSnapshot: () => ({ status: 'connected', synced }),
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
			},
		};
		const mount = async (config: CollaborationConfig | undefined, canEdit = true) => {
			await act(async () =>
				root.render(
					React.createElement(Harness, { content: null, collaboration: config, canEdit }),
				),
			);
			await flush();
		};
		try {
			await mount(collaboration);
			expect(latest!.canvasProps.canEdit).toBeFalsy();
			await act(async () => {
				synced = true;
				[...listeners].forEach((listener) => listener());
			});
			await flushUntil(() => latest?.canvasProps.canEdit === true);
			expect(latest!.canvasProps.canEdit).toBeTruthy();
			expect(latest!.toolbarProps.canEdit).toBeTruthy();
			await mount(collaboration, false);
			expect(latest!.canvasProps.canEdit).toBeFalsy();
			await act(async () => {
				synced = false;
				[...listeners].forEach((listener) => listener());
			});
			await mount(collaboration);
			expect(latest!.canvasProps.canEdit).toBeFalsy();
			await mount(undefined);
			expect(latest!.canvasProps.canEdit).toBeTruthy();
			await mount({
				...collaboration,
				role: 'viewer',
				externalSession: {
					...collaboration.externalSession!,
					subscribe() {
						throw new Error('Host subscription failed');
					},
				},
			});
			await flushUntil(() => latest?.collaboration?.status === 'error');
			expect(latest!.collaboration?.status).toBe('error');
			expect(latest!.canvasProps.canEdit).toBeTruthy();
		} finally {
			await act(async () => root.render(null));
			awareness.destroy();
			doc.destroy();
		}
	});

	it.each([
		{ canEdit: true, role: 'collaborator' as const, editableAfterLoad: true },
		{ canEdit: false, role: 'collaborator' as const, editableAfterLoad: false },
		{ canEdit: true, role: 'viewer' as const, editableAfterLoad: false },
	])(
		'keeps collaborative editing disabled until the original PPTX finishes loading ($role, canEdit=$canEdit)',
		async ({ canEdit, role, editableAfterLoad }) => {
			const original = new PptxHandler();
			const data = await original.load(textEditingFixtureBytes.buffer as ArrayBuffer);
			const doc = new Y.Doc();
			const awareness = new Awareness(doc);
			reconcileSlidesInYDoc(data.slides, doc, {
				createMap: () => new Y.Map(),
				createArray: () => new Y.Array(),
				createText: () => new Y.Text(),
			});
			const collaboration: CollaborationConfig = {
				roomId: 'delayed-headless-load',
				serverUrl: '',
				userName: 'Participant',
				role,
				sessionIntent: 'join',
				externalSession: {
					doc,
					awareness,
					getSnapshot: () => ({ status: 'connected', synced: true }),
					subscribe: () => () => {},
				},
			};
			let releaseLoad!: () => void;
			const loadGate = new Promise<void>((resolve) => {
				releaseLoad = resolve;
			});
			const realLoad = PptxHandler.prototype.load;
			const delayedLoad = vi
				.spyOn(PptxHandler.prototype, 'load')
				.mockImplementation(async function (this: PptxHandler, ...args) {
					const parsed = await realLoad.apply(this, args);
					await loadGate;
					return parsed;
				});
			const handle = createRef<PowerPointViewerHandle>();
			try {
				await act(async () =>
					root.render(
						React.createElement(Harness, {
							content: textEditingFixtureBytes,
							collaboration,
							handle,
							canEdit,
						}),
					),
				);
				await flushUntil(() => handle.current?.getElements().length === 2);
				expect(delayedLoad).toHaveBeenCalledWith(expect.any(ArrayBuffer), expect.any(Object));
				expect(latest!.canvasProps.activeSlide?.elements).toHaveLength(2);
				expect(latest!.loading).toBeTruthy();
				expect(latest!.canvasProps.canEdit).toBeFalsy();
				expect(latest!.toolbarProps.canEdit).toBeFalsy();
				await act(async () => releaseLoad());
				await flushUntil(() => latest?.loading === false);
				expect(latest!.error).toBeNull();
				expect(latest!.canvasProps.canEdit).toBe(editableAfterLoad);
				expect(latest!.toolbarProps.canEdit).toBe(editableAfterLoad);
				if (editableAfterLoad) {
					const first = handle.current!.getElements()[0];
					await act(async () =>
						latest!.canvasProps.onDoubleClick(
							first.id,
							new MouseEvent('dblclick') as unknown as React.MouseEvent,
						),
					);
					await flush();
					expect(latest!.canvasProps.inlineEditingElementId).toBe(first.id);
				}
			} finally {
				releaseLoad();
				delayedLoad.mockRestore();
				await act(async () => root.render(null));
				awareness.destroy();
				doc.destroy();
				original.dispose();
			}
		},
	);

	it('preserves non-collaborative authorization for blank documents and load errors', async () => {
		await act(async () => root.render(React.createElement(Harness, { content: null })));
		expect(latest!.loading).toBeTruthy();
		expect(latest!.canvasProps.canEdit).toBeTruthy();
		expect(latest!.toolbarProps.canEdit).toBeTruthy();
		const failedLoad = vi
			.spyOn(PptxHandler.prototype, 'load')
			.mockRejectedValue(new Error('Invalid presentation'));
		const loadError = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await act(async () => root.render(React.createElement(Harness, { content: fixtureBytes })));
			await flushUntil(() => latest?.loading === false);
			expect(latest!.loading).toBeFalsy();
			expect(latest!.error).toBe('Invalid presentation');
			expect(latest!.canvasProps.canEdit).toBeTruthy();
			expect(latest!.toolbarProps.canEdit).toBeTruthy();
		} finally {
			failedLoad.mockRestore();
			loadError.mockRestore();
		}
	});

	it('synchronizes two host-owned peers through the public headless API and saves their final deck', async () => {
		const firstDoc = new Y.Doc(),
			secondDoc = new Y.Doc();
		const firstAwareness = new Awareness(firstDoc),
			secondAwareness = new Awareness(secondDoc);
		const firstHandle = createRef<PowerPointViewerHandle>(),
			secondHandle = createRef<PowerPointViewerHandle>();
		const peerContainer = document.createElement('div');
		document.body.append(peerContainer);
		const peerRoot = createRoot(peerContainer);
		const original = new PptxHandler();
		const data = await original.load(textEditingFixtureBytes.buffer as ArrayBuffer);
		data.slides[0].elements[0].x = 45;
		reconcileSlidesInYDoc(data.slides, firstDoc, {
			createMap: () => new Y.Map(),
			createArray: () => new Y.Array(),
			createText: () => new Y.Text(),
		});
		Y.applyUpdate(secondDoc, Y.encodeStateAsUpdate(firstDoc));
		firstDoc.on('update', (update: Uint8Array, origin: unknown) => {
			if (origin !== 'peer') {
				Y.applyUpdate(secondDoc, update, 'peer');
			}
		});
		secondDoc.on('update', (update: Uint8Array, origin: unknown) => {
			if (origin !== 'peer') {
				Y.applyUpdate(firstDoc, update, 'peer');
			}
		});
		const config = (doc: Y.Doc, awareness: Awareness): CollaborationConfig => ({
			roomId: 'headless-test',
			serverUrl: '',
			userName: 'Participant',
			sessionIntent: 'join',
			externalSession: {
				doc,
				awareness,
				getSnapshot: () => ({ status: 'connected', synced: true }),
				subscribe: () => () => {},
			} satisfies ExternalCollaborationSession,
		});
		try {
			await act(async () => {
				root.render(
					React.createElement(Harness, {
						content: textEditingFixtureBytes,
						handle: firstHandle,
						collaboration: config(firstDoc, firstAwareness),
					}),
				);
				peerRoot.render(
					React.createElement(Harness, {
						content: textEditingFixtureBytes,
						handle: secondHandle,
						collaboration: config(secondDoc, secondAwareness),
					}),
				);
			});
			await flushUntil(
				() =>
					firstHandle.current?.getElements().length === 2 &&
					secondHandle.current?.getElements().length === 2,
			);
			await flushUntil(() => latest?.loading === false);
			expect(latest?.error).toBeNull();
			expect(firstHandle.current!.getElements()[0].x).toBe(45);
			expect(secondHandle.current!.getElements()[0].x).toBe(45);
			const [first, second] = firstHandle.current!.getElements();
			await act(async () => firstHandle.current!.updateElement(first.id, { x: 90 }));
			await flushUntil(() => secondHandle.current!.getElements()[0].x === 90);
			await act(async () => secondHandle.current!.updateElement(second.id, { y: 180 }));
			await flushUntil(() => firstHandle.current!.getElements()[1].y === 180);
			expect(secondHandle.current!.getSlides()).toStrictEqual(firstHandle.current!.getSlides());
			const saved = await firstHandle.current!.getContent();
			const reopened = new PptxHandler();
			const result = await reopened.load(saved.buffer as ArrayBuffer);
			expect(result.slides[0].elements[0].x).toBe(90);
			expect(result.slides[0].elements[1].y).toBe(180);
			reopened.dispose();
			await act(async () => {
				root.render(null);
				peerRoot.render(null);
			});
			expect(firstDoc.isDestroyed).toBeFalsy();
			expect(secondDoc.isDestroyed).toBeFalsy();
		} finally {
			await act(async () => peerRoot.unmount());
			peerContainer.remove();
			firstAwareness.destroy();
			secondAwareness.destroy();
			firstDoc.destroy();
			secondDoc.destroy();
			original.dispose();
		}
	}, 30_000);

	it('reports the full selection after a toolbar text-box insertion', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes, handle }));
		});
		await flushUntil(() => latest?.loading === false);
		await act(async () => {
			latest?.toolbarProps.onAddTextBox();
		});
		const added = handle.current?.getElements().at(-1);
		expect(added?.type).toBe('text');
		expect(handle.current?.getSelectedElementIds()).toStrictEqual([added?.id]);
		await flushUntil(() => handle.current?.canUndo() === true);
		expect(handle.current?.canUndo()).toBeTruthy();
	}, 15_000);

	it('owns native image paste on a mounted public canvas without a private viewer shell', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		const image = createImageElement('data:image/png;base64,aQ==', {
			x: 20,
			y: 30,
			width: 40,
			height: 30,
		});
		const decode = vi.spyOn(imageInsertion, 'createImageElementFromFile').mockResolvedValue(image);
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				disconnect() {}
			},
		);
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		async function mount(key: string, overrides?: Partial<SlideCanvasProps>): Promise<void> {
			await act(async () => {
				root.render(
					React.createElement(Harness, {
						content: fixtureBytes,
						handle,
						mountedCanvas: { key, overrides },
					}),
				);
			});
			await flushUntil(() => latest?.loading === false);
		}
		async function paste(): Promise<ClipboardEvent> {
			const stage = latest?.canvasProps.zoom.canvasStageRef.current;
			expect(stage).not.toBeNull();
			const clipboard = new DataTransfer();
			clipboard.items.add(new File(['image'], 'clipboard.png', { type: 'image/png' }));
			const event = new ClipboardEvent('paste', {
				bubbles: true,
				cancelable: true,
				clipboardData: clipboard,
			});
			await act(async () => {
				stage!.dispatchEvent(
					new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }),
				);
				stage!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
				stage!.dispatchEvent(
					new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }),
				);
				stage!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
			});
			await flush();
			await act(async () => {
				document.activeElement!.dispatchEvent(event);
			});
			return event;
		}
		try {
			await mount('canvas');
			expect(container.querySelectorAll('[data-pptx-image-paste-root]')).toHaveLength(1);
			const first = await paste();
			expect(first.defaultPrevented).toBeTruthy();
			expect(decode).toHaveBeenCalledOnce();
			await flushUntil(() => handle.current?.canUndo() === true);
			expect(
				handle.current?.getElements().filter((element) => element.type === 'image'),
			).toHaveLength(1);
			expect(handle.current?.getSelectedElementIds()).toHaveLength(1);
			expect(handle.current?.isDirty()).toBeTruthy();
			await act(async () => {
				handle.current?.undo();
			});
			expect(
				handle.current?.getElements().filter((element) => element.type === 'image'),
			).toHaveLength(0);
			await flush();
			await act(async () => {
				handle.current?.redo();
			});
			expect(
				handle.current?.getElements().filter((element) => element.type === 'image'),
			).toHaveLength(1);
			for (const overrides of [{ canEdit: false }, { mode: 'preview' as const }]) {
				await mount('canvas', overrides);
				expect((await paste()).defaultPrevented).toBeFalsy();
			}
			expect(decode).toHaveBeenCalledOnce();
			await mount('canvas');
			let finish: ((value: typeof image) => void) | undefined;
			decode.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					}),
			);
			expect((await paste()).defaultPrevented).toBeTruthy();
			const signal = decode.mock.calls.at(-1)?.[2];
			await mount('remounted-canvas');
			expect(signal?.aborted).toBeTruthy();
			await act(async () => {
				finish?.(image);
			});
			expect(
				handle.current?.getElements().filter((element) => element.type === 'image'),
			).toHaveLength(1);
			expect((await paste()).defaultPrevented).toBeTruthy();
			expect(decode).toHaveBeenCalledTimes(3);
			expect(
				handle.current?.getElements().filter((element) => element.type === 'image'),
			).toHaveLength(2);
		} finally {
			decode.mockRestore();
		}
	}, 30_000);

	it('refits a headless canvas remounted by a child without remounting its hook owner', async () => {
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		let width = 960;
		const observed = new Map<Element, () => void>();
		const prototype = HTMLElement.prototype;
		const widthSpy = vi.spyOn(prototype, 'clientWidth', 'get').mockImplementation(() => width);
		const heightSpy = vi.spyOn(prototype, 'clientHeight', 'get').mockReturnValue(540);
		vi.stubGlobal(
			'ResizeObserver',
			class {
				private node: Element | null = null;
				constructor(private callback: () => void) {}
				observe(node: Element) {
					this.node = node;
					observed.set(node, this.callback);
				}
				disconnect() {
					if (this.node) {
						observed.delete(this.node);
					}
				}
			},
		);
		const handle = createRef<PowerPointViewerHandle>();
		let toggleCanvas: (shown: boolean) => void = () => {};
		function CanvasChild({ result }: { result: ViewerBuildingBlocksResult }) {
			const [shown, setShown] = useState(true);
			toggleCanvas = setShown;
			return shown && !result.loading
				? React.createElement(SlideCanvas, { ...result.canvasProps, showRulers: false })
				: null;
		}
		function HeadlessHarness() {
			const result = useViewerBuildingBlocks({
				content: fixtureBytes,
				handle,
				canEdit: true,
				fitPadding: 0,
				maxFitScale: null,
			});
			latest = result;
			return React.createElement(CanvasChild, { result });
		}
		try {
			await act(async () => root.render(React.createElement(HeadlessHarness)));
			await flushUntil(() => latest?.loading === false);
			const first = container.querySelector('[data-pptx-viewport]')!;
			expect(first).not.toBeNull();
			const slideWidth = latest!.canvasProps.canvasSize.width;
			expect(latest!.canvasProps.zoom.editorScale).toBeCloseTo(960 / slideWidth);
			act(() => toggleCanvas(false));
			width = 480;
			act(() => toggleCanvas(true));
			const second = container.querySelector('[data-pptx-viewport]')!;
			expect(second).not.toBe(first);
			expect(latest!.canvasProps.zoom.editorScale).toBeCloseTo(480 / slideWidth);
			expect(observed.has(first)).toBeFalsy();
			expect(observed.has(second)).toBeTruthy();
			width = 720;
			act(() => observed.get(second)!());
			expect(latest!.canvasProps.zoom.editorScale).toBeCloseTo(720 / slideWidth);
			act(() => handle.current!.setMode('preview'));
			expect(latest!.canvasProps.zoom.editorScale).toBeCloseTo(720 / slideWidth);
			act(() => handle.current!.setMode('edit'));
			expect(latest!.canvasProps.zoom.editorScale).toBeCloseTo(720 / slideWidth);
			expect(handle.current!.isDirty()).toBeFalsy();
		} finally {
			widthSpy.mockRestore();
			heightSpy.mockRestore();
		}
	}, 15_000);

	it('forwards opt-in viewport fit without marking the loaded deck dirty', async () => {
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				disconnect() {}
			},
		);
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(
				React.createElement(Harness, {
					content: fixtureBytes,
					handle,
					fitPadding: 0,
					maxFitScale: null,
					measuredViewport: { width: 1920, height: 1080 },
				}),
			);
		});
		await flushUntil(() => latest?.loading === false);
		expect(latest).toMatchObject({ loading: false });
		expect(latest?.error).toBeNull();
		const { canvasProps } = latest as ViewerBuildingBlocksResult;
		const expected = Math.min(
			1920 / canvasProps.canvasSize.width,
			1080 / canvasProps.canvasSize.height,
		);
		expect(expected).toBeGreaterThan(1);
		expect(canvasProps.zoom.editorScale).toBeCloseTo(expected);
		expect(handle.current?.isDirty()).toBeFalsy();
		expect(latestAutosaveDirty()).toBeFalsy();
	}, 15_000);

	it('preserves embedded fonts through getContent after switching decks', async () => {
		const embeddedBytes = embeddedFixtureBytes;
		const loader = new PptxHandler();
		const parsed = await loader.load(embeddedBytes.buffer as ArrayBuffer);
		expect(parsed.embeddedFonts?.map((font) => font.name)).toStrictEqual(['Sample Font']);
		loader.dispose();
		const original = await JSZip.loadAsync(embeddedBytes);
		const fontPaths = Object.keys(original.files).filter((name) => name.endsWith('.fntdata'));
		expect(fontPaths).toHaveLength(1);
		const handle = createRef<PowerPointViewerHandle>();
		async function loadAndSave(content: Uint8Array): Promise<JSZip> {
			await act(async () => {
				root.render(React.createElement(Harness, { content, handle }));
			});
			await flushUntil(() => latest?.loading === false);
			expect(latest?.loading).toBeFalsy();
			expect(latest?.error).toBeNull();
			let savedBytes: Uint8Array | undefined;
			await act(async () => {
				savedBytes = await handle.current?.getContent();
			});
			expect(savedBytes).toBeDefined();
			return JSZip.loadAsync(savedBytes!);
		}
		for (const content of [fixtureBytes, embeddedBytes, fixtureBytes, embeddedBytes]) {
			const saved = await loadAndSave(content);
			const expectedPaths = content === embeddedBytes ? fontPaths : [];
			expect(
				Object.keys(saved.files)
					.filter((name) => name.endsWith('.fntdata'))
					.sort(),
			).toStrictEqual([...expectedPaths].sort());
			const presentation = await saved.file('ppt/presentation.xml')!.async('string');
			const relationships = await saved.file('ppt/_rels/presentation.xml.rels')!.async('string');
			expect(presentation.includes('embeddedFontLst')).toBe(content === embeddedBytes);
			expect([...relationships.matchAll(/Type="[^"]*\/font"/gu)]).toHaveLength(
				expectedPaths.length,
			);
			for (const fontPath of expectedPaths) {
				await expect(saved.file(fontPath)!.async('uint8array')).resolves.toStrictEqual(
					await original.file(fontPath)!.async('uint8array'),
				);
				expect(relationships).toContain(`Target="${fontPath.substring(4)}"`);
			}
		}
	}, 30_000);

	it.each(['click-away', 'explicit-commit', 'click-away-after-undo'] as const)(
		'records an inline text change after %s without needing another document edit',
		async (commit) => {
			const handle = createRef<PowerPointViewerHandle>();
			await act(async () =>
				root.render(React.createElement(Harness, { content: textEditingFixtureBytes, handle })),
			);
			await flushUntil(() => latest?.loading === false);
			expect(latest?.loading).toBeFalsy();
			const [first, second] = handle.current!.getElements();
			expect(handle.current!.canUndo()).toBeFalsy();
			if (commit === 'click-away-after-undo') {
				await act(async () => {
					handle.current!.updateElement(first.id, { x: first.x + 10 });
				});
				expect(handle.current!.canUndo()).toBeTruthy();
				await act(async () => {
					handle.current!.undo();
				});
				await flush();
				expect(handle.current!.canRedo()).toBeTruthy();
			}
			await act(async () =>
				latest!.canvasProps.onDoubleClick(
					first.id,
					new MouseEvent('dblclick') as unknown as React.MouseEvent,
				),
			);
			await act(async () => latest!.canvasProps.onInlineEditChange('First body edited'));
			if (commit !== 'explicit-commit') {
				await act(async () =>
					latest!.canvasProps.onMouseDown(
						second.id,
						new MouseEvent('mousedown', {
							button: 0,
							clientX: 30,
							clientY: 130,
						}) as unknown as React.MouseEvent,
					),
				);
				// Pointerup is a separate native event: allow the history effect to
				// observe the pending selection drag first. No pointermove occurs.
				await act(async () => {
					document.dispatchEvent(new Event('pointerup'));
				});
			} else {
				await act(async () => latest!.canvasProps.onInlineEditCommit());
			}
			await flush();
			const edited = handle.current!.getElementById(first.id);
			expect(edited?.type === 'text' && edited.text).toBe('First body edited');
			expect(latest!.canvasProps.inlineEditingElementId).toBeNull();
			expect(handle.current!.canRedo()).toBeFalsy();
			expect(handle.current!.canUndo()).toBeTruthy();
			await act(async () => handle.current!.undo());
			const restored = handle.current!.getElementById(first.id);
			expect(restored?.type === 'text' && restored.text).toBe('First body');
		},
	);

	it('does not dirty the document or create history for selection or unrelated pointerup', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: textEditingFixtureBytes, handle }));
		});
		await flushUntil(() => latest?.loading === false);
		expect(latest?.loading).toBeFalsy();
		const [first] = handle.current!.getElements();
		await act(async () => {
			latest!.canvasProps.onMouseDown(
				first.id,
				new MouseEvent('mousedown', { button: 0 }) as unknown as React.MouseEvent,
			);
		});
		await act(async () => {
			document.dispatchEvent(new Event('pointerup'));
		});
		await act(async () => {
			document.dispatchEvent(new Event('pointerup'));
		});
		expect(handle.current!.getElementById(first.id)).toStrictEqual(first);
		expect(handle.current!.isDirty()).toBeFalsy();
		expect(handle.current!.canUndo()).toBeFalsy();
		expect(handle.current!.canRedo()).toBeFalsy();
	});

	it('coalesces multiple real drag frames into one undo step on pointerup', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: textEditingFixtureBytes, handle }));
		});
		await flushUntil(() => latest?.loading === false);
		expect(latest?.loading).toBeFalsy();
		const [first] = handle.current!.getElements();
		await act(async () => {
			latest!.canvasProps.onMouseDown(
				first.id,
				new MouseEvent('mousedown', {
					button: 0,
					clientX: 20,
					clientY: 20,
				}) as unknown as React.MouseEvent,
			);
		});
		for (const x of [50, 90]) {
			await act(async () => {
				document.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 50 }));
				await new Promise<void>((resolve) => {
					requestAnimationFrame(() => resolve());
				});
			});
			expect(handle.current!.canUndo()).toBeFalsy();
		}
		await act(async () => {
			document.dispatchEvent(new Event('pointerup'));
		});
		expect(handle.current!.getElementById(first.id)?.x).not.toBe(first.x);
		expect(handle.current!.canUndo()).toBeTruthy();
		await act(async () => {
			handle.current!.undo();
		});
		expect(handle.current!.getElementById(first.id)).toStrictEqual(first);
		expect(handle.current!.canUndo()).toBeFalsy();
	});

	const insertion: PptxElement = {
		id: 'caller-owned',
		type: 'text',
		x: 25,
		y: 30,
		width: 200,
		height: 60,
		text: 'Inserted text',
		textStyle: { fontSize: 24 },
	};

	it('inserts a selected defensive copy with ordinary Undo and Redo', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes, handle }));
		});
		await flushUntil(() => latest?.loading === false);
		const original = structuredClone(insertion);
		let id: string | undefined;
		await act(async () => {
			id = handle.current?.addElement(insertion);
		});
		await flushUntil(() => handle.current?.canUndo() === true);
		expect(id).toBeTypeOf('string');
		expect(id).not.toBe(insertion.id);
		expect(handle.current?.getElementById(id!)).toStrictEqual({ ...insertion, id });
		expect(handle.current?.getSelectedElementIds()).toStrictEqual([id]);
		expect(handle.current?.isDirty()).toBeTruthy();
		expect(insertion).toStrictEqual(original);
		await act(async () => {
			handle.current?.undo();
		});
		expect(handle.current?.getElementById(id!)).toBeUndefined();
		await flush();
		await act(async () => {
			handle.current?.redo();
		});
		expect(handle.current?.getElementById(id!)).toStrictEqual({ ...insertion, id });
	});

	it('keeps both insertions made synchronously with distinct IDs', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes, handle }));
		});
		await flushUntil(() => latest?.loading === false);
		const ids: (string | undefined)[] = [];
		await act(async () => {
			ids.push(handle.current?.addElement(insertion), handle.current?.addElement(insertion));
		});
		expect(ids[0]).toBeTypeOf('string');
		expect(ids[1]).toBeTypeOf('string');
		expect(ids[0]).not.toBe(ids[1]);
		expect(handle.current?.getElements().map((element) => element.id)).toStrictEqual(
			expect.arrayContaining(ids),
		);
		expect(handle.current?.getSelectedElementIds()).toStrictEqual([ids[1]]);
	});

	it.each(['preview', 'present', 'master'] as const)('does not insert in %s mode', async (mode) => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes, handle }));
		});
		await flushUntil(() => latest?.loading === false);
		await act(async () => {
			handle.current?.setMode(mode);
		});
		let id: string | undefined;
		await act(async () => {
			id = handle.current?.addElement(insertion);
		});
		expect(id).toBeUndefined();
		expect(handle.current?.isDirty()).toBeFalsy();
		expect(handle.current?.getSelectedElementIds()).toStrictEqual([]);
	});

	it('does not insert without host edit permission', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes, handle, canEdit: false }));
		});
		await flushUntil(() => latest?.loading === false);
		await act(async () => {
			handle.current?.setMode('edit');
		});
		expect(handle.current?.addElement(insertion)).toBeUndefined();
		expect(handle.current?.isDirty()).toBeFalsy();
	});

	it('commits pending inline text before inserting another element', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes, handle }));
		});
		await flushUntil(() => latest?.loading === false);
		let firstId: string | undefined;
		await act(async () => {
			firstId = handle.current?.addElement(insertion);
		});
		await act(async () => {
			latest?.canvasProps.onDoubleClick(
				firstId!,
				new MouseEvent('dblclick') as unknown as React.MouseEvent,
			);
		});
		await act(async () => {
			latest?.canvasProps.onInlineEditChange('Latest pending text');
		});
		let secondId: string | undefined;
		await act(async () => {
			secondId = handle.current?.addElement(insertion);
		});
		const edited = handle.current?.getElementById(firstId!);
		expect(edited?.type === 'text' && edited.text).toBe('Latest pending text');
		expect(handle.current?.getElementById(secondId!)).toBeDefined();
		expect(handle.current?.getSelectedElementIds()).toStrictEqual([secondId]);
		expect(latest?.canvasProps.inlineEditingElementId).toBeNull();
	});

	it('does not insert before load or while editing a template', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes, handle }));
		});
		expect(handle.current?.addElement(insertion)).toBeUndefined();
		await flushUntil(() => latest?.loading === false);
		await act(async () => {
			latest?.toolbarProps.onSetEditTemplateMode(true);
		});
		expect(handle.current?.addElement(insertion)).toBeUndefined();
		expect(handle.current?.isDirty()).toBeFalsy();
		expect(handle.current?.getSelectedElementIds()).toStrictEqual([]);
	});

	it('honors a loaded read-only recommendation even when the headless host permits editing', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: readOnlyFixtureBytes, handle }));
		});
		await flushUntil(() => latest?.loading === false);
		expect(handle.current?.addElement(insertion)).toBeUndefined();
		expect(handle.current?.isDirty()).toBeFalsy();
		expect(handle.current?.getSelectedElementIds()).toStrictEqual([]);
	});

	it('does not insert when the persisted viewer option enables Protected View', async () => {
		const options = createViewerOptionsStore();
		options.setValue('trust', 'openInProtectedView', true);
		const handle = createRef<PowerPointViewerHandle>();
		try {
			await act(async () => {
				root.render(React.createElement(Harness, { content: fixtureBytes, handle }));
			});
			await flushUntil(() => latest?.loading === false);
			expect(handle.current?.addElement(insertion)).toBeUndefined();
			expect(handle.current?.isDirty()).toBeFalsy();
		} finally {
			options.setValue('trust', 'openInProtectedView', false);
		}
	});

	it.each([false, true])(
		'saves and reloads a self-contained image after Undo/Redo=%s',
		async (undoRedo) => {
			const handle = createRef<PowerPointViewerHandle>();
			await act(async () => {
				root.render(React.createElement(Harness, { content: fixtureBytes, handle }));
			});
			await flushUntil(() => latest?.loading === false);
			const image: PptxElement = {
				id: 'caller-image',
				type: 'image',
				name: 'Inserted image',
				x: 12,
				y: 34,
				width: 48,
				height: 56,
				imageData:
					'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2ZJkAAAAASUVORK5CYII=',
			};
			await act(async () => {
				handle.current?.addElement(image);
			});
			if (undoRedo) {
				await flushUntil(() => handle.current?.canUndo() === true);
				await act(async () => {
					handle.current?.undo();
				});
				expect(
					handle.current?.getElements().some((element) => element.name === image.name),
				).toBeFalsy();
				await flush();
				await act(async () => {
					handle.current?.redo();
				});
				expect(
					handle.current?.getElements().some((element) => element.name === image.name),
				).toBeTruthy();
			}
			const saved = await handle.current!.getContent();
			const handler = new PptxHandler();
			try {
				const reloaded = await handler.load(
					saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
				);
				const restored = reloaded.slides[0].elements.find((element) => element.name === image.name);
				expect(restored).toMatchObject({ x: 12, y: 34, width: 48, height: 56 });
				expect(restored?.type === 'image' || restored?.type === 'picture').toBeTruthy();
				if (restored?.type === 'image' || restored?.type === 'picture') {
					const zip = await JSZip.loadAsync(saved);
					expect(restored.imagePath).toBeTypeOf('string');
					await expect(zip.file(restored.imagePath!)?.async('base64')).resolves.toBe(
						image.imageData!.split(',')[1],
					);
				}
			} finally {
				handler.dispose();
			}
		},
	);

	it('exposes public element insertion on the headless handle', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		await act(async () => {
			root.render(React.createElement(Harness, { content: fixtureBytes, handle }));
		});
		await flushUntil(() => latest?.loading === false);
		expect(handle.current).toHaveProperty('addElement', expect.any(Function));
	});

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

	it('reports a committed edit to the host and opens the autosave dirty gate', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		const dirtyChanges: boolean[] = [];
		await act(async () => {
			root.render(
				React.createElement(Harness, {
					content: fixtureBytes,
					handle,
					onDirtyChange: (dirty: boolean) => dirtyChanges.push(dirty),
				}),
			);
		});
		await flushUntil(() => latest?.loading === false);

		expect(handle.current?.isDirty()).toBeFalsy();
		expect(latestAutosaveDirty()).toBeFalsy();
		expect(dirtyChanges).not.toContain(true);

		await act(async () => {
			handle.current?.addSlide();
			await Promise.resolve();
		});
		await flushUntil(() => handle.current?.isDirty() === true);

		expect(handle.current?.getSlideCount()).toBe(2);
		expect(handle.current?.isDirty()).toBeTruthy();
		expect(latestAutosaveDirty()).toBeTruthy();
		expect(dirtyChanges).toContain(true);
	}, 15_000);

	it('does not report slide navigation as a document edit', async () => {
		const handle = createRef<PowerPointViewerHandle>();
		const dirtyChanges: boolean[] = [];
		await act(async () => {
			root.render(
				React.createElement(Harness, {
					content: twoSlideFixtureBytes,
					handle,
					onDirtyChange: (dirty: boolean) => dirtyChanges.push(dirty),
				}),
			);
		});
		await flushUntil(() => latest?.loading === false);

		await act(async () => {
			handle.current?.goTo(1);
			await Promise.resolve();
		});
		await flushUntil(() => handle.current?.getActiveSlideIndex() === 1);

		expect(handle.current?.isDirty()).toBeFalsy();
		expect(latestAutosaveDirty()).toBeFalsy();
		expect(dirtyChanges).not.toContain(true);
	}, 15_000);
});
