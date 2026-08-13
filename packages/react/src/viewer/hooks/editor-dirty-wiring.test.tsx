// @vitest-environment happy-dom
/**
 * Does an ordinary edit actually mark the document dirty?
 *
 * `state.isDirty` gates `useAutosave`: `doAutosave` returns immediately while
 * the document reads clean, so a dirty flag that never rises means React has no
 * crash recovery at all. It shipped that way. `markDirty()` - which every edit
 * choke point in the editor already called - only bumped the history hook's
 * private commit nonce; `setIsDirty(true)` lived in a handful of master-view and
 * document-property handlers and nowhere else. Measured on the running demo:
 * after Home > New Slide the status bar still read "All saved" and IndexedDB
 * stayed empty.
 *
 * A unit test asserting "isDirty flips" would have passed for the entire life of
 * the bug, because the flag existed and was wired to the status bar; what was
 * missing was anything RAISING it. So this mounts the real `PowerPointViewer`
 * through the package entry point, captures the input the real composition hands
 * `useAutosave`, and drives a real edit through the public handle. Only
 * `useAutosave` itself is replaced, and only so the value it receives can be
 * read; every other hook in the chain is production code.
 */
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UseAutosaveInput } from './useAutosave';

const { autosaveInputs } = vi.hoisted(() => ({ autosaveInputs: [] as UseAutosaveInput[] }));

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock(import('./useAutosave'), () => ({
	useAutosave: (input: UseAutosaveInput) => {
		autosaveInputs.push(input);
		return { autosaveStatus: { state: 'idle' as const }, triggerAutosave: async () => {} };
	},
}));

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
		i18n: {
			language: 'en',
			languages: ['en'],
			options: { resources: { en: {} } },
			changeLanguage: () => Promise.resolve(),
		},
	}),
}));

const { PptxHandler } = await import('pptx-viewer-core');
const { PowerPointViewer } = await import('../../index');
type ViewerHandle = import('../../index').PowerPointViewerHandle;

/** A real one-slide package, so the viewer mounts its editor chrome. */
async function sampleDeck(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	// happy-dom defaults to a phone-sized window, and the viewer answers that
	// with its mobile bottom bar instead of the ribbon.
	window.happyDOM?.setViewport({ width: 1600, height: 950 });
	autosaveInputs.length = 0;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

/**
 * The value the real composition most recently handed `useAutosave`. It throws
 * rather than returning `undefined` so the `toBeFalsy` assertions below cannot
 * pass on "the hook was never called".
 */
function latestAutosaveDirty(): boolean {
	const input = autosaveInputs.at(-1);
	if (!input) {
		throw new Error('the composition never called useAutosave');
	}
	return input.isDirty;
}

/** The published handle, or a hard failure: a `?.` here would pass on null. */
function handleOf(ref: React.RefObject<ViewerHandle | null>): ViewerHandle {
	if (!ref.current) {
		throw new Error('PowerPointViewer published no imperative handle');
	}
	return ref.current;
}

/** Let the async load pipeline settle so there is a deck to edit. */
async function flushUntilLoaded(ref: React.RefObject<ViewerHandle | null>): Promise<void> {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		// Re-read `ref.current` every pass: `useImperativeHandle` publishes a NEW
		// handle object per render, and the one from the first render closes over
		// the empty pre-load slide array forever.
		if ((ref.current?.getSlideCount() ?? 0) > 0) {
			return;
		}
		await act(async () => {
			await new Promise((resolve) => {
				setTimeout(resolve, 20);
			});
		});
	}
	throw new Error('the viewer never finished loading its deck');
}

describe('an ordinary edit marks the document dirty', () => {
	it('raises the dirty flag useAutosave gates on, and reports it to the host', async () => {
		const content = await sampleDeck();
		const ref = createRef<ViewerHandle>();
		const dirtyChanges: boolean[] = [];
		await act(async () => {
			root.render(
				<PowerPointViewer
					ref={ref}
					content={content}
					filePath='dirty-wiring.pptx'
					onDirtyChange={(dirty) => dirtyChanges.push(dirty)}
				/>,
			);
		});
		await flushUntilLoaded(ref);

		// Nothing has been edited yet: the deck is clean and autosave has nothing
		// to write. This half must keep passing, or the fix has simply pinned the
		// flag on and made "unsaved changes" meaningless.
		expect(latestAutosaveDirty()).toBeFalsy();
		expect(handleOf(ref).isDirty()).toBeFalsy();
		expect(dirtyChanges).not.toContain(true);

		// `addSlide()` on the public handle runs the SAME production handler the
		// Home > New Slide ribbon button does (`slideOps.handleAddSlide`), which
		// is the edit the e2e recovery spec uses because it commits in all five
		// bindings. Driving it through the handle keeps the probe out of the
		// chrome's responsive layout.
		const before = handleOf(ref).getSlideCount();
		await act(async () => {
			ref.current?.addSlide();
			await Promise.resolve();
		});
		expect(handleOf(ref).getSlideCount()).toBe(before + 1);

		expect(
			latestAutosaveDirty(),
			'useAutosave short-circuits on a clean document, so a false here is no crash recovery',
		).toBeTruthy();
		expect(handleOf(ref).isDirty()).toBeTruthy();
		expect(dirtyChanges).toContain(true);
	});
});
