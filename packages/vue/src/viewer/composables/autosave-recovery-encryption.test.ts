/**
 * autosave-recovery-encryption.test.ts: the crash-recovery snapshot must stay
 * restorable when the deck is password protected.
 *
 * Vue's autosave called `getContent()`, the same serialiser the user's Save
 * uses. Once `getContent` learned to honour the protection dialog, enabling a
 * password also encrypted the IndexedDB recovery snapshot - and nothing that
 * reads a snapshot back has the password (`readBackstageRecentFile`,
 * `restoreSessionDeck` and Version History Restore all call `PptxHandler.load()`
 * with no `password` option), so the recovery copy became unopenable.
 *
 * This drives the REAL `useAutosaveWiring` over the REAL `useLoadContent`,
 * intercepts the bytes at `saveAutosaveSnapshot`, and reopens them with no
 * password. A spy on `saveEncrypted` would have passed throughout the bug.
 */
// @vitest-environment node
// Node rather than the package-wide happy-dom: nothing here renders, and the
// key-derivation loop runs an order of magnitude faster outside the DOM shim.
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';

const { savedSnapshots } = vi.hoisted(() => ({
	savedSnapshots: [] as Array<{ key: string; data: Uint8Array }>,
}));

// Intercept the IndexedDB write (there is no IndexedDB here) and keep the
// bytes. Everything else in the shared package stays real.
vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	saveAutosaveSnapshot: async (key: string, data: Uint8Array) => {
		savedSnapshots.push({ key, data });
		return true;
	},
}));

const { useAutosaveWiring } = await import('./useAutosaveWiring');
const { useLoadContent } = await import('./useLoadContent');
const { usePasswordProtection } = await import('./usePasswordProtection');

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Keep the REAL encryptor (the bytes must be a genuine OLE2 container) but drop
 * the agile key derivation from 100,000 rounds to 100. Nothing in the path
 * under test is replaced; full strength just costs minutes per call.
 */
function weakenKeyDerivation(handler: PptxHandler): void {
	const real = handler.saveEncrypted.bind(handler);
	vi.spyOn(handler, 'saveEncrypted').mockImplementation((slides, password, options) =>
		real(slides, password, { ...options, encryption: { spinCount: 100 } }),
	);
}

/** Build a tiny real `.pptx` to feed the composable's load pipeline. */
async function buildDeckBytes(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 2 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
}

describe('vue autosave snapshot vs password protection', () => {
	it('persists a restorable plain ZIP snapshot for a protected deck', async () => {
		savedSnapshots.length = 0;
		const bytes = await buildDeckBytes();
		const scope = effectScope();
		try {
			await scope.run(async () => {
				const password = usePasswordProtection();
				const content = ref<Uint8Array | null>(bytes);
				const deck = useLoadContent(() => content.value, {
					// Exactly the accessor `PowerPointViewer.vue` passes.
					getSaveIntent: () => ({
						password: password.presentationPassword.value,
						passwordProtected: password.isPasswordProtected.value,
					}),
				});

				for (let i = 0; i < 200 && (deck.loading.value || !deck.handler.value); i++) {
					await nextTick();
					await new Promise((resolve) => {
						setTimeout(resolve, 10);
					});
				}
				const handler = deck.handler.value;
				expect(handler).toBeTruthy();
				weakenKeyDerivation(handler as PptxHandler);

				// The user protects the deck.
				password.onSetPassword('hunter2!A');

				// Exactly the wiring `PowerPointViewer.vue` sets up.
				const emitted: Uint8Array[] = [];
				const wiring = useAutosaveWiring({
					slides: shallowRef(deck.slides.value),
					loading: deck.loading,
					canEdit: () => true,
					autosaveEnabledByHost: () => true,
					intervalMs: () => 2000,
					snapshotName: () => 'deck.pptx',
					getRecoverySnapshot: deck.getRecoverySnapshot,
					emitAutosave: (out) => emitted.push(out),
					captureVersion: () => {},
				});

				await wiring.autosave.saveNow();

				expect(savedSnapshots).toHaveLength(1);
				const snapshot = savedSnapshots[0]!.data;
				// A plain ZIP, not an OLE compound file.
				expect(Array.from(snapshot.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);
				// The `@autosave` emit carries the same recovery bytes.
				expect(emitted).toHaveLength(1);
				expect(Array.from(emitted[0]!.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);

				// And it really restores: recovery has no password to offer.
				const recovery = new PptxHandler();
				try {
					const restored = await recovery.load(toArrayBuffer(snapshot));
					expect(restored.slides).toHaveLength(2);
				} finally {
					recovery.dispose();
				}

				// The user's own Save is still genuinely encrypted: this fix must
				// not have quietly turned password protection off.
				const userFile = await deck.getContent();
				expect(Array.from(userFile.slice(0, 8))).toStrictEqual([
					0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
				]);
			});
		} finally {
			scope.stop();
		}
	}, 120_000);
});
