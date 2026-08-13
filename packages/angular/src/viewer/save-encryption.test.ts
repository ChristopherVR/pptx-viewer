/**
 * save-encryption.test.ts: File > Info > Protect Presentation must produce a
 * file that is actually encrypted.
 *
 * `ViewerDialogsService.presentationPassword` was written by the dialog and
 * read by nobody, so a "protected" deck saved as a plain ZIP. The password now
 * reaches `LoadContentService.saveSlides`, which routes through the shared
 * `saveDeckWithPassword`. This asserts the BYTES: OLE compound-file magic with
 * a password, ZIP magic without.
 *
 * Built in a throwaway injection context with a `DestroyRef` stub, same as
 * `load-content-docprops.test.ts`; no TestBed.
 */
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { recoverySnapshotIntent } from '../internal/shared';
import { LoadContentService } from './load-content.service';

/**
 * Keep the REAL encryptor (so the bytes really are an encrypted OLE2
 * container) but drop the agile key derivation from its 100,000-round default
 * to 100. Full strength costs minutes per call under vitest and proves nothing
 * extra: the container, the cipher and the streams are identical.
 */
function weakenKeyDerivation(handler: PptxHandler): void {
	const real = handler.saveEncrypted.bind(handler);
	vi.spyOn(handler, 'saveEncrypted').mockImplementation((slides, password, options) =>
		real(slides, password, { ...options, encryption: { spinCount: 100 } }),
	);
}

function createService(): LoadContentService {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = {
		onDestroy: () => () => {},
	};
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: destroyRefStub }],
	});
	return runInInjectionContext(injector, () => new LoadContentService());
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('loadContentService password protection', () => {
	it('encrypts the saved deck when the dialog password reaches saveSlides', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		const sourceBytes = await handler.save(data.slides);
		handler.dispose();

		const svc = createService();
		await svc.load(toArrayBuffer(sourceBytes));
		expect(svc.slides()).toHaveLength(1);
		weakenKeyDerivation(svc.getHandler() as PptxHandler);

		const plain = await svc.saveSlides(svc.slides());
		expect(Array.from(plain.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);

		// Exactly the intent `PowerPointViewerComponent` binds as `saveIntent`.
		const secret = await svc.saveSlides(svc.slides(), 'pptx', undefined, {
			password: 'hunter2!A',
			passwordProtected: true,
		});
		expect(Array.from(secret.slice(0, 8))).toStrictEqual([
			0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
		]);

		// "Remove password" must not leave a stale secret encrypting the save.
		const cleared = await svc.saveSlides(svc.slides(), 'pptx', undefined, {
			password: 'hunter2!A',
			passwordProtected: false,
		});
		expect(Array.from(cleared.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);
	}, 60_000);

	it('leaves the autosave recovery snapshot a restorable plain ZIP', async () => {
		// The crash-recovery snapshot is reopened with no password (React and Vue
		// shipped an encrypted one, which nothing could restore). Angular's
		// `serializeForAutosave` states that with `recoverySnapshotIntent`; this
		// pins the resulting BYTES and an actual restore.
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 2 });
		const sourceBytes = await handler.save(data.slides);
		handler.dispose();

		const svc = createService();
		await svc.load(toArrayBuffer(sourceBytes));
		weakenKeyDerivation(svc.getHandler() as PptxHandler);

		const snapshot = await svc.saveSlides(
			svc.slides(),
			'pptx',
			undefined,
			recoverySnapshotIntent({ password: 'hunter2!A', passwordProtected: true }),
		);
		expect(Array.from(snapshot.slice(0, 4))).toStrictEqual([0x50, 0x4b, 0x03, 0x04]);

		const recovery = new PptxHandler();
		try {
			const restored = await recovery.load(toArrayBuffer(snapshot));
			expect(restored.slides).toHaveLength(2);
		} finally {
			recovery.dispose();
		}
	}, 60_000);
});
