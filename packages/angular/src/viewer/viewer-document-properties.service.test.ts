/**
 * viewer-document-properties.service.test.ts: pins that Info-dialog saves
 * write the loader's `coreProperties` signal (the state `saveSlides`
 * serialises, shared with the inspector DOCUMENT card) instead of the old
 * dialog-local override, mark the deck dirty, and still notify the host
 * `propertiesChange` output. No TestBed (matching the repo's service tests):
 * services are constructed inside a plain `Injector` context with a
 * DestroyRef stub for {@link LoadContentService}.
 */
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import type { PptxCoreProperties } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { ViewerDocumentPropertiesService } from './viewer-document-properties.service';

interface Harness {
	svc: ViewerDocumentPropertiesService;
	editor: EditorStateService;
	loader: LoadContentService;
	emitted: Array<Partial<PptxCoreProperties>>;
}

function createHarness(canEdit: boolean): Harness {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = { onDestroy: () => () => {} };
	const editor = new EditorStateService();
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: destroyRefStub },
			{ provide: EditorStateService, useValue: editor },
			LoadContentService,
			ViewerDocumentPropertiesService,
		],
	});
	const loader = injector.get(LoadContentService);
	const svc = injector.get(ViewerDocumentPropertiesService);
	const emitted: Array<Partial<PptxCoreProperties>> = [];
	runInInjectionContext(injector, () => {
		svc.bind({
			canEdit: () => canEdit,
			selectedElement: () => null,
			activeSlideIndex: () => 0,
			emitPropertiesChange: (patch) => emitted.push(patch),
		});
	});
	return { svc, editor, loader, emitted };
}

describe('viewerDocumentPropertiesService Info-dialog saves', () => {
	it('writes the loader coreProperties signal, marks dirty, and notifies the host', () => {
		const { svc, editor, loader, emitted } = createHarness(true);
		loader.coreProperties.set({ title: 'Original', creator: 'Author' });
		svc.showProperties.set(true);

		svc.onPropertiesSave({ title: 'Edited Title', subject: 'Quarterly' });

		expect(loader.coreProperties()).toMatchObject({
			title: 'Edited Title',
			creator: 'Author',
			subject: 'Quarterly',
		});
		expect(svc.coreProperties()).toMatchObject({ title: 'Edited Title', subject: 'Quarterly' });
		expect(editor.dirty()).toBeTruthy();
		expect(emitted).toStrictEqual([{ title: 'Edited Title', subject: 'Quarterly' }]);
		expect(svc.showProperties()).toBeFalsy();
	});

	it('starts from an empty object when nothing was loaded', () => {
		const { svc, loader } = createHarness(true);
		expect(loader.coreProperties()).toBeUndefined();

		svc.onPropertiesSave({ title: 'Fresh' });

		expect(loader.coreProperties()).toStrictEqual({ title: 'Fresh' });
	});

	it('is a no-op besides closing the dialog when canEdit is false', () => {
		const { svc, editor, loader, emitted } = createHarness(false);
		loader.coreProperties.set({ title: 'Original' });
		svc.showProperties.set(true);

		svc.onPropertiesSave({ title: 'Should Not Apply' });

		expect(loader.coreProperties()).toStrictEqual({ title: 'Original' });
		expect(editor.dirty()).toBeFalsy();
		expect(emitted).toStrictEqual([]);
		expect(svc.showProperties()).toBeFalsy();
	});
});
