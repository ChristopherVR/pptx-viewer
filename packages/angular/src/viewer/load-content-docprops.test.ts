/**
 * load-content-docprops.test.ts: round-trip test for document-property
 * persistence through `LoadContentService.saveSlides`.
 *
 * The DOCUMENT inspector card edits the loader's `coreProperties` /
 * `appProperties` / `customProperties` signals; `saveSlides` must forward
 * them to `handler.save()` (core's `PptxDocumentPropertiesUpdater` then
 * rewrites `docProps/core.xml` / `app.xml` / `custom.xml`), the same wiring
 * React's `useSerialize` uses. This test edits the signals exactly like the
 * card does, saves, reparses the bytes with a fresh `PptxHandler`, and
 * asserts the edited values survived.
 *
 * The service calls `inject(DestroyRef)` in its constructor, so it is built
 * inside a minimal injection context (same pattern as
 * `collaboration-helpers.test.ts`); no TestBed.
 */
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import type { PptxCustomProperty } from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { LoadContentService } from './load-content.service';

/** Build the service in a throwaway injection context with a DestroyRef stub. */
function createService(): { svc: LoadContentService; destroy: () => void } {
	const destroyCallbacks: Array<() => void> = [];
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = {
		onDestroy: (callback: () => void) => {
			destroyCallbacks.push(callback);
			return () => {};
		},
	};
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: destroyRefStub }],
	});
	const svc = runInInjectionContext(injector, () => new LoadContentService());
	return {
		svc,
		destroy: () => {
			for (const callback of destroyCallbacks) {
				callback();
			}
		},
	};
}

/** Copy a saved Uint8Array into a standalone ArrayBuffer for reloading. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('loadContentService document-property persistence', () => {
	it('persists DOCUMENT-card edits (core/app/custom properties) through save + reparse', async () => {
		// Generate a minimal valid .pptx (includes docProps/core.xml + app.xml).
		const { handler: sourceHandler, data } = await PptxHandler.create({
			title: 'Original Title',
			creator: 'Original Author',
			initialSlideCount: 1,
		});
		const sourceBytes = await sourceHandler.save(data.slides);
		sourceHandler.dispose();

		const { svc, destroy } = createService();
		try {
			await svc.load(toArrayBuffer(sourceBytes));
			expect(svc.error()).toBeNull();
			expect(svc.slides().length).toBeGreaterThan(0);

			// Edit the signals exactly like DocumentPropertiesCardComponent does.
			svc.coreProperties.update((current) => ({
				...(current ?? {}),
				title: 'Edited Title',
				creator: 'Edited Author',
			}));
			svc.appProperties.update((current) => ({ ...(current ?? {}), company: 'Acme Corp' }));
			const custom: PptxCustomProperty[] = [{ name: 'Project', value: 'Apollo', type: 'lpwstr' }];
			svc.customProperties.set(custom);

			// Save through the Angular save pipeline and reparse with a fresh handler.
			const savedBytes = await svc.saveSlides(svc.slides());
			const reparser = new PptxHandler();
			try {
				const reparsed = await reparser.load(toArrayBuffer(savedBytes));

				expect(reparsed.coreProperties?.title).toBe('Edited Title');
				expect(reparsed.coreProperties?.creator).toBe('Edited Author');
				expect(reparsed.appProperties?.company).toBe('Acme Corp');
				const savedCustom = reparsed.customProperties ?? [];
				expect(savedCustom.some((p) => p.name === 'Project' && p.value === 'Apollo')).toBeTruthy();
			} finally {
				reparser.dispose();
			}
		} finally {
			destroy();
		}
	});
});
