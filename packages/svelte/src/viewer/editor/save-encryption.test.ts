/**
 * save-encryption.test.ts: File > Info > Protect Presentation must produce a
 * file that is actually encrypted.
 *
 * Svelte used to hold the password in `Ribbon.svelte`'s local `$state` where
 * nothing read it, so a "protected" deck saved as a plain ZIP. The secret now
 * lives on `EditorState` and `saveEditorDocument` routes through the shared
 * `saveDeckWithPassword`. This asserts the BYTES: OLE compound-file magic with
 * a password, ZIP magic without. A spy on `saveEncrypted` would have passed
 * the whole time the bug shipped.
 */
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditorSnapshot } from './editor-document-state';
import { saveEditorDocument } from './editor-document-state';

/**
 * Keep the REAL encryptor (so the bytes really are an encrypted OLE2
 * container) but drop the agile key derivation from its 100,000-round default
 * to 100. Full strength adds seconds to minutes per call under vitest and
 * proves nothing extra: the container, the cipher and the streams are
 * identical. The save path under test is untouched.
 */
function weakenKeyDerivation(handler: PptxHandler): void {
	const real = handler.saveEncrypted.bind(handler);
	vi.spyOn(handler, 'saveEncrypted').mockImplementation((slides, password, options) =>
		real(slides, password, { ...options, encryption: { spinCount: 100 } }),
	);
}

function emptySnapshot(slides: EditorSnapshot['slides']): EditorSnapshot {
	return {
		slides,
		templateElementsBySlideId: {},
		slideMasters: [],
		notesMaster: undefined,
		handoutMaster: undefined,
		sections: [],
		headerFooter: {},
		presentationProperties: {},
		customShows: [],
		coreProperties: undefined,
		appProperties: undefined,
		customProperties: [],
		tagCollections: [],
	};
}

describe('saveEditorDocument password protection', () => {
	it('writes an encrypted OLE container when the save intent carries a password', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		weakenKeyDerivation(handler);
		try {
			const snapshot = emptySnapshot(data.slides);

			const plain = await saveEditorDocument(handler, snapshot, 'pptx');
			expect(Array.from(plain.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);

			const secret = await saveEditorDocument(handler, snapshot, 'pptx', {
				password: 'hunter2!A',
				passwordProtected: true,
			});
			expect(Array.from(secret.slice(0, 8))).toStrictEqual([
				0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
			]);

			// "Remove password" must not leave a stale secret encrypting the save.
			const cleared = await saveEditorDocument(handler, snapshot, 'pptx', {
				password: 'hunter2!A',
				passwordProtected: false,
			});
			expect(Array.from(cleared.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);
		} finally {
			handler.dispose();
		}
	}, 60_000);
});
