/**
 * save-encryption.test.ts: File > Info > Protect Presentation must produce a
 * file that is actually encrypted.
 *
 * `openPasswordProtectionDialog`'s `onSet(password)` used to drop its argument
 * and flip a badge, so a "protected" deck saved as a plain ZIP. The secret now
 * lives on `ViewerState.presentationPassword` and `ops.save()` routes through
 * the shared `saveDeckWithPassword`. This asserts the BYTES: OLE compound-file
 * magic with a password, ZIP magic without.
 */
// @vitest-environment node
// Node rather than the package-wide DOM shim: nothing here renders, and the
// key-derivation loop is an order of magnitude faster outside it.
import type { PptxHandler } from 'pptx-viewer-core';
import { PptxHandler as Handler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';

/**
 * Keep the REAL encryptor (so the bytes really are an encrypted OLE2
 * container) but drop the agile key derivation from its 100,000-round default
 * to 100. Full strength costs ~2.5 minutes per call in this package's vitest
 * and proves nothing extra: the container, the cipher and the streams are
 * identical. The save path under test is untouched.
 */
function weakenKeyDerivation(handler: PptxHandler): void {
	const real = handler.saveEncrypted.bind(handler);
	vi.spyOn(handler, 'saveEncrypted').mockImplementation((slides, password, options) =>
		real(slides, password, { ...options, encryption: { spinCount: 100 } }),
	);
}

describe('vanilla editor save password protection', () => {
	it('encrypts the saved deck when the protection dialog stored a password', async () => {
		const { handler, data } = await Handler.create({ initialSlideCount: 1 });
		weakenKeyDerivation(handler);
		try {
			const store = createStore({
				...createInitialViewerState(),
				slides: data.slides,
				currentSlide: 0,
				editable: true,
			});
			const ops = createEditorOps({
				store,
				getHandler: () => handler,
				onHistoryChange: vi.fn(),
			});

			const plain = await ops.save('pptx');
			expect(Array.from(plain.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);

			// Exactly what `PptxViewer.openPasswordProtection`'s `onSet` now writes.
			store.set({ isPasswordProtected: true, presentationPassword: 'hunter2!A' });
			const secret = await ops.save('pptx');
			expect(Array.from(secret.slice(0, 8))).toStrictEqual([
				0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
			]);

			// ... and what its `onRemove` writes: straight back to a plain package.
			store.set({ isPasswordProtected: false, presentationPassword: null });
			const cleared = await ops.save('pptx');
			expect(Array.from(cleared.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);
		} finally {
			handler.dispose();
		}
	}, 60_000);
});
