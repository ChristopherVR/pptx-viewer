/**
 * font-embedding-save.test.ts: File > Fonts > "Embed fonts in the file" must
 * change the bytes that get written.
 *
 * The toggle shipped in every binding and was read by nobody: it reached no
 * save call, so a deck saved byte-identical whichever way it sat.
 * `LoadContentService` now seeds it from the loaded deck (a deck that arrives
 * with embedded fonts keeps them, so the switch starts ON) and spreads
 * `embeddedFontSaveOptions` into the save options.
 *
 * This asserts the PACKAGE, not that a spy fired: the `.fntdata` part and
 * `p:embeddedFontLst` are present with the toggle on and gone with it off.
 *
 * Built in a throwaway injection context with a `DestroyRef` stub, same as
 * `save-encryption.test.ts`; no TestBed.
 */
import { DestroyRef, Injector } from '@angular/core';
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { LoadContentService } from './load-content.service';
import { ViewerDialogsService } from './viewer-dialogs.service';

function createServices(): { loader: LoadContentService; dialogs: ViewerDialogsService } {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = {
		onDestroy: () => () => {},
	};
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: destroyRefStub },
			LoadContentService,
			ViewerDialogsService,
		],
	});
	return {
		loader: injector.get(LoadContentService),
		dialogs: injector.get(ViewerDialogsService),
	};
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Build a tiny real `.pptx` that embeds one font. */
async function buildDeckWithEmbeddedFont(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		const rawFontData = new Uint8Array(64);
		// A plausible TrueType signature so the loader resolves the part.
		rawFontData.set([0, 1, 0, 0]);
		return await handler.save(data.slides, {
			embeddedFonts: [{ name: 'Probe Face', dataUrl: '', rawFontData, format: 'truetype' }],
		});
	} finally {
		handler.dispose();
	}
}

/** Font parts + list presence for a saved package. */
async function inspect(bytes: Uint8Array): Promise<{ parts: string[]; hasList: boolean }> {
	const zip = await JSZip.loadAsync(bytes);
	const presentation = await zip.file('ppt/presentation.xml')!.async('string');
	return {
		parts: Object.keys(zip.files).filter((path) => path.endsWith('.fntdata')),
		hasList: presentation.includes('embeddedFontLst'),
	};
}

describe('font embedding save wiring', () => {
	it('keeps the embedded font when the toggle is on and strips it when off', async () => {
		const { loader, dialogs } = createServices();
		await loader.load(toArrayBuffer(await buildDeckWithEmbeddedFont()));
		expect(loader.embeddedFonts().map((font) => font.name)).toStrictEqual(['Probe Face']);

		// Seeded from the deck: it arrived with an embedded font, and save keeps
		// those by default, so the switch has to say so from the start. The panel
		// reads the same signal the save path does, not a copy of it.
		expect(dialogs.fontEmbedding().interactive).toBeTruthy();
		expect(dialogs.embedFontsEnabled()).toBeTruthy();

		const kept = await inspect(await loader.saveSlides(loader.slides()));
		expect(kept.parts).toHaveLength(1);
		expect(kept.hasList).toBeTruthy();

		// Exactly what the panel's (toggleEmbedFonts) handler does.
		dialogs.embedFontsEnabled.set(false);
		const stripped = await inspect(await loader.saveSlides(loader.slides()));
		expect(stripped.parts).toStrictEqual([]);
		expect(stripped.hasList).toBeFalsy();
	}, 60_000);

	it('leaves the toggle inert and off for a deck that embeds nothing', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		const plain = await handler.save(data.slides);
		handler.dispose();

		const { loader, dialogs } = createServices();
		await loader.load(toArrayBuffer(plain));

		expect(dialogs.fontEmbedding().interactive).toBeFalsy();
		expect(dialogs.fontEmbedding().disabledReasonKey).toBe('pptx.fonts.embedUnavailable');
		expect(dialogs.embedFontsEnabled()).toBeFalsy();
	}, 60_000);
});
