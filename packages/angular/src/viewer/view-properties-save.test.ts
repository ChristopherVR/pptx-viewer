/**
 * view-properties-save.test.ts: the View-ribbon grid/guide/snap toggles must
 * reach the saved `ppt/viewProps.xml`.
 *
 * `PowerPointViewerComponent` patches `LoadContentService.viewProperties` on
 * every toggle, but `saveSlides()` never forwarded that signal, so core fell
 * back to the part as it was FIRST opened and every session change silently
 * reverted at the file boundary.
 *
 * Asserts the PACKAGE, not that a spy fired: `ppt/viewProps.xml` is unzipped
 * and its attributes read back. Same throwaway injection context as
 * `table-style-save.test.ts`; no TestBed.
 */
import { DestroyRef, Injector } from '@angular/core';
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { LoadContentService } from './load-content.service';

function createLoader(): LoadContentService {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = {
		onDestroy: () => () => {},
	};
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: destroyRefStub }, LoadContentService],
	});
	return injector.get(LoadContentService);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function buildDeck(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
}

async function readViewProps(bytes: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	return (await zip.file('ppt/viewProps.xml')?.async('string')) ?? '';
}

describe('view properties save wiring', () => {
	it('writes the session viewProperties, not the as-loaded part', async () => {
		const loader = createLoader();
		await loader.load(toArrayBuffer(await buildDeck()));

		// What the View ribbon's grid-spacing / comments toggles write.
		loader.viewProperties.set({
			...loader.viewProperties(),
			showComments: false,
			gridSpacing: { cx: 152400, cy: 152400 },
		});

		const xml = await readViewProps(await loader.saveSlides(loader.slides()));
		expect(xml).toMatch(/<p:viewPr\b[^>]*\bshowComments="0"/u);
		expect(xml).toMatch(/<p:gridSpacing\b[^>]*\bcx="152400"/u);
	});
});
