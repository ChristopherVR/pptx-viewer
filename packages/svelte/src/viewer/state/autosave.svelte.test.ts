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
			getSlideMasters: () => editor.slideMasters,
			getNotesMaster: () => editor.notesMaster,
			getHandoutMaster: () => editor.handoutMaster,
			getHandler: () => handler,
			getLoadCount: () => loads.value,
			getSeedNonce: () => editor.seedNonce,
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
		h.editor.slides = [slide('s1'), slide('s2')];
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

	it('tracks master edits and serializes notes and handout master options', async () => {
		const h = setup();
		// Assigned directly, the way a master-view edit commits. `setSlides` is
		// the LOAD path (it reseeds the session), so using it here would be
		// asserting the wrong thing.
		h.editor.notesMaster = { path: 'notes.xml', elements: [] };
		h.editor.handoutMaster = { path: 'handout.xml', elements: [], slidesPerPage: 6 };
		flushSync();
		expect(h.ctl.isDirty).toBeTruthy();

		await vi.advanceTimersByTimeAsync(1000);

		expect(h.save).toHaveBeenCalledWith(
			h.editor.slides,
			expect.objectContaining({
				notesMaster: h.editor.notesMaster,
				handoutMaster: h.editor.handoutMaster,
			}),
		);
		h.dispose();
	});

	it('treats a load (loadCount bump) as a reseed: clears dirty, no save', async () => {
		const h = setup();
		h.editor.slides = [slide('s1'), slide('s2')];
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
		h.editor.slides = [slide('s1'), slide('s2')];
		flushSync();
		expect(h.ctl.isDirty).toBeTruthy();
		await vi.advanceTimersByTimeAsync(5000);
		expect(saveSnapshot).not.toHaveBeenCalled();
		h.dispose();
	});

	/**
	 * The promise a plain debounce cannot keep. Every edit re-arms the timer, so
	 * before the shared `nextAutosaveDelayMs` ceiling a user who kept typing
	 * pushed the snapshot out forever: at the two-minute AutoRecover cadence,
	 * a whole session of work that never reached the recovery store. Editing
	 * every 400ms for 4s below produces ZERO saves against an unbounded
	 * debounce; with the ceiling the window restarts at each snapshot, so the
	 * deadlines land at 1000ms, 2200ms and 3400ms.
	 */
	it('still snapshots within one interval while the user keeps editing', async () => {
		const h = setup();
		for (let i = 0; i < 10; i++) {
			h.editor.slides = Array.from({ length: i + 2 }, (_, n) => slide(`s${n}`));
			flushSync();
			await vi.advanceTimersByTimeAsync(400);
		}

		// 4000ms of unbroken editing: three interval deadlines have passed.
		expect(saveSnapshot).toHaveBeenCalledTimes(3);
		h.dispose();
	});

	it('waits a full interval again after a save, not less', async () => {
		const h = setup();
		h.editor.slides = [slide('s1'), slide('s2')];
		flushSync();
		await vi.advanceTimersByTimeAsync(1000);
		expect(saveSnapshot).toHaveBeenCalledOnce();

		h.editor.slides = [slide('s1'), slide('s2'), slide('s3')];
		flushSync();
		await vi.advanceTimersByTimeAsync(999);
		expect(saveSnapshot).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(1);
		expect(saveSnapshot).toHaveBeenCalledTimes(2);
		h.dispose();
	});

	/**
	 * Opening a deck is not editing it.
	 *
	 * The two halves of a load arrive in DIFFERENT flushes. The loader bumps its
	 * `loadCount` first; the seeding effect in `viewer-effects.svelte.ts` reacts
	 * to that and only then calls `editor.setSlides(...)`. This controller's
	 * effect therefore ran twice: once on the count (against the OLD slides, so
	 * it cleared dirty and settled) and once on the slide reassignment, by which
	 * point the count already matched - indistinguishable from a user edit.
	 * Measured on the running demos: IndexedDB held a recovery snapshot ~2s
	 * after a plain load with no interaction, so the next visit offered to
	 * "recover unsaved changes" for a deck that had only been read. Angular and
	 * Vanilla poll an explicit dirty flag and never did this.
	 *
	 * `EditorState.seedNonce` closes it by changing in the same synchronous block
	 * as the slides it describes.
	 */
	it('treats a load whose slides land AFTER the count bump as a reseed', async () => {
		const h = setup();

		// Exactly the real ordering: the count moves on its own...
		h.loads.value = 2;
		flushSync();
		// ...and the slides are adopted in a later flush.
		h.editor.setSlides([slide('x1'), slide('x2')]);
		flushSync();

		expect(h.ctl.isDirty).toBeFalsy();
		await vi.advanceTimersByTimeAsync(2000);
		expect(saveSnapshot).not.toHaveBeenCalled();
		h.dispose();
	});

	it('still autosaves the first edit made after such a load', async () => {
		const h = setup();

		h.loads.value = 2;
		flushSync();
		h.editor.setSlides([slide('x1'), slide('x2')]);
		flushSync();
		await vi.advanceTimersByTimeAsync(2000);
		expect(saveSnapshot).not.toHaveBeenCalled();

		// A real edit commits by reassigning the slide array.
		h.editor.slides = [...h.editor.slides, slide('x3')];
		flushSync();
		expect(h.ctl.isDirty).toBeTruthy();
		await vi.advanceTimersByTimeAsync(1000);

		expect(saveSnapshot).toHaveBeenCalledOnce();
		h.dispose();
	});

	it('is inert without a filePath', async () => {
		const h = setup({ filePath: '' });
		h.editor.slides = [slide('s1'), slide('s2')];
		flushSync();
		await vi.advanceTimersByTimeAsync(2000);
		expect(saveSnapshot).not.toHaveBeenCalled();
		h.dispose();
	});
});
