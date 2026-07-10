import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../editor/editor-state.svelte';
import { AutosaveController } from './autosave.svelte';

/**
 * `.svelte.test.ts` so the runes runtime compiles the controller's edit-
 * watching `$effect`. The shared IndexedDB writer is mocked (happy-dom has no
 * IndexedDB); the tests assert the debounce / dirty / load-vs-edit routing.
 */

const { saveSnapshot } = vi.hoisted(() => ({ saveSnapshot: vi.fn().mockResolvedValue(true) }));
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	saveAutosaveSnapshot: saveSnapshot,
}));

function slide(id: string): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [] };
}

/** Reactive load-counter holder (a runes class so `$state` is legal here). */
class LoadCounter {
	value = $state(1);
}

function fakeHandler(): { handler: PptxHandler; save: ReturnType<typeof vi.fn> } {
	const save = vi.fn(async () => new Uint8Array([1, 2, 3]));
	return { handler: { save } as unknown as PptxHandler, save };
}

interface Harness {
	editor: EditorState;
	loads: LoadCounter;
	ctl: AutosaveController;
	save: ReturnType<typeof vi.fn>;
	onSaved: ReturnType<typeof vi.fn>;
	dispose: () => void;
}

function setup(opts: { enabled?: boolean; filePath?: string } = {}): Harness {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.setSlides([slide('s1')]);
	const loads = new LoadCounter();
	const { handler, save } = fakeHandler();
	const onSaved = vi.fn();
	let ctl!: AutosaveController;
	const dispose = $effect.root(() => {
		ctl = new AutosaveController({
			getEnabled: () => opts.enabled ?? true,
			getIntervalMs: () => 1000,
			getFilePath: () => opts.filePath ?? 'deck.pptx',
			getSlides: () => editor.slides,
			getHandler: () => handler,
			getLoadCount: () => loads.value,
			onSaved,
		});
	});
	flushSync(); // first-run skip
	return { editor, loads, ctl, save, onSaved, dispose };
}

describe('autosaveController', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		saveSnapshot.mockClear();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('does not mark dirty on the initial (setup) run', () => {
		const h = setup();
		expect(h.ctl.isDirty).toBeFalsy();
		expect(h.ctl.status).toBe('idle');
		h.dispose();
	});

	it('debounces an edit, persists the bytes, and reports saved', async () => {
		const h = setup();
		h.editor.setSlides([slide('s1'), slide('s2')]);
		flushSync();
		expect(h.ctl.isDirty).toBeTruthy();
		expect(h.ctl.status).toBe('idle');

		await vi.advanceTimersByTimeAsync(1000);

		expect(saveSnapshot).toHaveBeenCalledExactlyOnceWith('deck.pptx', expect.any(Uint8Array));
		expect(h.save).toHaveBeenCalledOnce();
		expect(h.onSaved).toHaveBeenCalledWith(expect.any(Uint8Array));
		expect(h.ctl.status).toBe('saved');
		expect(h.ctl.isDirty).toBeFalsy();
		h.dispose();
	});

	it('treats a load (loadCount bump) as a reseed: clears dirty, no save', async () => {
		const h = setup();
		h.editor.setSlides([slide('s1'), slide('s2')]);
		flushSync();
		expect(h.ctl.isDirty).toBeTruthy();

		// Simulate a fresh presentation load: bump the counter + reseed slides.
		h.loads.value = 2;
		h.editor.setSlides([slide('x1')]);
		flushSync();

		expect(h.ctl.isDirty).toBeFalsy();
		await vi.advanceTimersByTimeAsync(1000);
		expect(saveSnapshot).not.toHaveBeenCalled();
		h.dispose();
	});

	it('when disabled, marks dirty but never schedules a save', async () => {
		const h = setup({ enabled: false });
		h.editor.setSlides([slide('s1'), slide('s2')]);
		flushSync();
		expect(h.ctl.isDirty).toBeTruthy();
		await vi.advanceTimersByTimeAsync(5000);
		expect(saveSnapshot).not.toHaveBeenCalled();
		h.dispose();
	});

	it('is inert without a filePath', async () => {
		const h = setup({ filePath: '' });
		h.editor.setSlides([slide('s1'), slide('s2')]);
		flushSync();
		await vi.advanceTimersByTimeAsync(2000);
		expect(saveSnapshot).not.toHaveBeenCalled();
		h.dispose();
	});
});
