/**
 * autosave-recovery-encryption.test.ts: the crash-recovery snapshot must stay
 * restorable when the deck is password protected.
 *
 * React and Vue shipped an ENCRYPTED autosave snapshot (their autosave reused
 * the user's save serialiser), which no recovery path can reopen: they all call
 * `PptxHandler.load()` with no `password` option. Vanilla was accidentally safe
 * because `runSave` called `handler.save` directly; it now states the decision
 * through the shared `recoverySnapshotIntent` instead, so this pins the BYTES
 * and an actual restore rather than the accident.
 */
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';

const { savedSnapshots } = vi.hoisted(() => ({
	savedSnapshots: [] as Array<{ key: string; data: Uint8Array }>,
}));

// No IndexedDB in this environment: intercept the write and keep the bytes.
// Every other shared symbol (including the save decision) stays real.
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	saveAutosaveSnapshot: async (key: string, data: Uint8Array) => {
		savedSnapshots.push({ key, data });
		return true;
	},
	probeAutosaveRecovery: async () => null,
}));

const { createAutosaveController } = await import('./autosave-controller');

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('vanilla autosave snapshot vs password protection', () => {
	it('persists a restorable plain ZIP snapshot for a protected deck', async () => {
		savedSnapshots.length = 0;
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 2 });
		const store = createStore(createInitialViewerState());
		// The deck IS protected; the snapshot must ignore that.
		store.set({
			slides: data.slides,
			dirty: true,
			presentationPassword: 'hunter2!A',
			isPasswordProtected: true,
		});

		const controller = createAutosaveController({
			store,
			getHandler: () => handler,
			filePath: 'deck.pptx',
			getIntervalMs: () => 2000,
			// Exactly the accessor `createSessionControllers` passes.
			getSaveIntent: () => ({
				password: store.get().presentationPassword,
				passwordProtected: store.get().isPasswordProtected,
			}),
		});

		try {
			await controller.saveNow();

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
			controller.destroy();
			handler.dispose();
		}
	}, 60_000);
});
