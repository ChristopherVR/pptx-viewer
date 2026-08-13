/**
 * save-encryption.test.ts: File ▸ Info ▸ Protect Presentation must produce a
 * file that is actually encrypted.
 *
 * Vue used to store the password in `usePasswordProtection` and never read it,
 * so a "protected" deck saved as a plain ZIP. `useLoadContent` now takes a
 * `getSaveIntent` accessor and routes `saveAs` through the shared
 * `saveDeckWithPassword`. This test asserts the BYTES, not that a spy fired:
 * OLE compound-file magic with a password, ZIP magic without.
 */
// @vitest-environment node
// Node rather than the package-wide happy-dom: nothing here renders, and the
// key-derivation loop runs an order of magnitude faster outside the DOM shim.
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useLoadContent } from './useLoadContent';
import { usePasswordProtection } from './usePasswordProtection';

/**
 * Keep the REAL encryptor (so the bytes really are an encrypted OLE2
 * container) but drop the agile key derivation from its 100,000-round default
 * to 100. Full strength costs ~2 minutes per call in this package's vitest and
 * proves nothing extra: the container, the cipher and the streams are
 * identical. Nothing about the save path under test is replaced.
 */
function weakenKeyDerivation(handler: PptxHandler): void {
	const real = handler.saveEncrypted.bind(handler);
	vi.spyOn(handler, 'saveEncrypted').mockImplementation((slides, password, options) =>
		real(slides, password, { ...options, encryption: { spinCount: 100 } }),
	);
}

/** Build a tiny real `.pptx` to feed the composable's load pipeline. */
async function buildDeckBytes(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
}

describe('useLoadContent save encryption', () => {
	it('encrypts the saved deck when the protection dialog set a password', async () => {
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

				// Wait for the load pipeline to settle (the watcher is `immediate`).
				for (let i = 0; i < 200 && (deck.loading.value || !deck.handler.value); i++) {
					await nextTick();
					await new Promise((resolve) => {
						setTimeout(resolve, 10);
					});
				}
				const handler = deck.handler.value;
				expect(handler).toBeTruthy();
				weakenKeyDerivation(handler as PptxHandler);

				const plain = await deck.saveAs('pptx');
				expect(Array.from(plain.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);

				password.onSetPassword('hunter2!A');
				const secret = await deck.saveAs('pptx');
				expect(Array.from(secret.slice(0, 8))).toStrictEqual([
					0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
				]);

				// Removing the password must go straight back to a plain package.
				password.onRemovePassword();
				const cleared = await deck.saveAs('pptx');
				expect(Array.from(cleared.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);
			});
		} finally {
			scope.stop();
		}
	}, 60_000);
});
