/**
 * autosave-recovery-encryption.svelte.test.ts: the crash-recovery snapshot must
 * stay restorable when the deck is password protected.
 *
 * React and Vue shipped an ENCRYPTED autosave snapshot (their autosave reused
 * the user's save serialiser), which no recovery path can reopen: they all call
 * `PptxHandler.load()` with no `password` option. Svelte was accidentally safe
 * because `AutosaveController` called `handler.save` directly; it now states
 * the decision through the shared `recoverySnapshotIntent` instead, so this
 * pins the BYTES and an actual restore rather than the accident.
 *
 * `.svelte.test.ts` so the runes runtime compiles the controller's `$effect`.
 */
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { AutosaveController } from './autosave.svelte';

const { savedSnapshots } = vi.hoisted(() => ({
	savedSnapshots: [] as Array<{ key: string; data: Uint8Array }>,
}));

// happy-dom has no IndexedDB: intercept the write and keep the bytes. Every
// other shared symbol (including the save decision under test) stays real.
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	saveAutosaveSnapshot: async (key: string, data: Uint8Array) => {
		savedSnapshots.push({ key, data });
		return true;
	},
}));

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('svelte autosave snapshot vs password protection', () => {
	it('persists a restorable plain ZIP snapshot for a protected deck', async () => {
		savedSnapshots.length = 0;
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 2 });
		let ctl!: AutosaveController;
		const dispose = $effect.root(() => {
			ctl = new AutosaveController({
				getEnabled: () => true,
				getIntervalMs: () => 1000,
				getFilePath: () => 'deck.pptx',
				getSlides: () => data.slides,
				getHandler: () => handler,
				getLoadCount: () => 1,
				// The deck IS protected; the snapshot must ignore that.
				getSaveIntent: () => ({ password: 'hunter2!A', passwordProtected: true }),
			});
		});
		try {
			await ctl.save();

			expect(ctl.status).toBe('saved');
			expect(savedSnapshots).toHaveLength(1);
			const snapshot = savedSnapshots[0]!.data;
			// A plain ZIP, not an OLE compound file.
			expect(Array.from(snapshot.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);

			const recovery = new PptxHandler();
			try {
				const restored = await recovery.load(toArrayBuffer(snapshot));
				expect(restored.slides).toHaveLength(2);
			} finally {
				recovery.dispose();
			}
		} finally {
			dispose();
			handler.dispose();
		}
	}, 60_000);
});
