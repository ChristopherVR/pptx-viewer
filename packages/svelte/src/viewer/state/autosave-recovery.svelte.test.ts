import type { AutosaveRecord } from 'pptx-viewer-shared';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AutosaveRecoveryController } from './autosave-recovery.svelte';

/**
 * The Svelte viewer wrote crash-recovery snapshots and never offered one back,
 * so the feature was invisible: a lost tab silently threw the work away. These
 * pin the probe -> prompt -> restore/discard flow.
 *
 * `.svelte.test.ts` so the runes runtime compiles the controller's probing
 * `$effect`. Only the IndexedDB *storage* is faked (happy-dom has no
 * IndexedDB); every DECISION (the probe guard, the freshness window, the
 * per-tab consumed marker, the prompt's own strings) runs for real out of
 * `pptx-viewer-shared`.
 */

const { snapshots } = vi.hoisted(() => ({ snapshots: new Map<string, AutosaveRecord>() }));
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		probeAutosaveRecovery: async (filePath: string, now: number = Date.now()) => {
			const record = snapshots.get(filePath);
			const prompt = actual.autosaveRecoveryPrompt({
				record,
				now,
				consumedTimestamp: actual.consumedAutosaveSnapshotTimestamp(),
			});
			return prompt && record ? { prompt, record } : null;
		},
		discardAutosaveRecovery: async (record: { key: string; timestamp: number }) => {
			actual.markAutosaveSnapshotConsumed(record.timestamp);
			snapshots.delete(record.key);
		},
	};
});

/** Reactive loader stand-in: the four values the probe guard reads. */
class FakeLoader {
	loading = $state(false);
	error = $state<string | null>(null);
	slideCount = $state(2);
	loadCount = $state(1);
}

interface Harness {
	loader: FakeLoader;
	ctl: AutosaveRecoveryController;
	load: ReturnType<typeof vi.fn>;
	dispose: () => void;
}

function setup(opts: { filePath?: string; allowed?: boolean } = {}): Harness {
	const loader = new FakeLoader();
	const load = vi.fn(async () => {
		loader.loadCount += 1;
	});
	let ctl!: AutosaveRecoveryController;
	const dispose = $effect.root(() => {
		ctl = new AutosaveRecoveryController({
			getFilePath: () => ('filePath' in opts ? opts.filePath : 'deck.pptx'),
			getAutosaveAllowed: () => opts.allowed ?? true,
			getLoading: () => loader.loading,
			getError: () => loader.error,
			getSlideCount: () => loader.slideCount,
			getLoadCount: () => loader.loadCount,
			load,
		});
	});
	flushSync();
	return { loader, ctl, load, dispose };
}

function seedSnapshot(ageMs = 60_000): Uint8Array {
	const data = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
	snapshots.set('deck.pptx', { key: 'deck.pptx', timestamp: Date.now() - ageMs, size: 4096, data });
	return data;
}

describe('autosaveRecoveryController', () => {
	beforeEach(() => {
		snapshots.clear();
		sessionStorage.clear();
	});
	afterEach(() => {
		sessionStorage.clear();
	});

	it('offers a fresh snapshot as a translatable prompt', async () => {
		seedSnapshot();
		const h = setup();

		await vi.waitFor(() => expect(h.ctl.prompt).not.toBeNull());

		expect(h.ctl.prompt).toMatchObject({
			filePath: 'deck.pptx',
			titleKey: 'pptx.autosave.recovery.title',
			messageKey: 'pptx.autosave.recovery.message',
			restoreKey: 'pptx.autosave.recovery.restore',
			discardKey: 'pptx.autosave.recovery.discard',
			ageKey: 'pptx.autosave.oneMinAgo',
			messageParams: { file: 'deck.pptx', size: '4 KB' },
		});
		h.dispose();
	});

	it('stays silent when there is no snapshot to recover', async () => {
		const h = setup();
		await vi.waitFor(() => expect(h.load).not.toHaveBeenCalled());
		expect(h.ctl.prompt).toBeNull();
		h.dispose();
	});

	it('never probes when the host forbade autosave', async () => {
		seedSnapshot();
		const h = setup({ allowed: false });
		await Promise.resolve();
		flushSync();
		expect(h.ctl.prompt).toBeNull();
		h.dispose();
	});

	it('never probes without a filePath to key the record', async () => {
		seedSnapshot();
		const h = setup({ filePath: undefined });
		await Promise.resolve();
		flushSync();
		expect(h.ctl.prompt).toBeNull();
		h.dispose();
	});

	it('hands the snapshot bytes to the loader on restore, and closes', async () => {
		const data = seedSnapshot();
		const h = setup();
		await vi.waitFor(() => expect(h.ctl.prompt).not.toBeNull());

		await h.ctl.restore();

		expect(h.load).toHaveBeenCalledExactlyOnceWith(data);
		expect(h.ctl.prompt).toBeNull();
		// Kept, not deleted: restoring is not consuming the only copy.
		expect(snapshots.has('deck.pptx')).toBeTruthy();
		h.dispose();
	});

	it('does not re-offer the snapshot it just restored', async () => {
		seedSnapshot();
		const h = setup();
		await vi.waitFor(() => expect(h.ctl.prompt).not.toBeNull());

		await h.ctl.restore();
		// `load` bumped the load counter, which re-arms the once-per-deck probe.
		flushSync();
		await Promise.resolve();
		flushSync();

		expect(h.ctl.prompt).toBeNull();
		h.dispose();
	});

	it('deletes the snapshot on discard and never loads it', async () => {
		seedSnapshot();
		const h = setup();
		await vi.waitFor(() => expect(h.ctl.prompt).not.toBeNull());

		await h.ctl.discard();

		expect(h.load).not.toHaveBeenCalled();
		expect(h.ctl.prompt).toBeNull();
		expect(snapshots.has('deck.pptx')).toBeFalsy();
		h.dispose();
	});
});
