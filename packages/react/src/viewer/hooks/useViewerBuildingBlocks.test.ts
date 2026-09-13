import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { createViewerOptionsStore } from 'pptx-viewer-shared';
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
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
	content,
	handle,
	onDirtyChange,
	canEdit = true,
}: {
	content: Uint8Array;
	handle?: React.RefObject<PowerPointViewerHandle | null>;
	onDirtyChange?: (dirty: boolean) => void;
	canEdit?: boolean;
}): React.ReactElement {
	const result = useViewerBuildingBlocks({ content, canEdit, handle, onDirtyChange });
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
});

describe('useViewerBuildingBlocks', () => {
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
