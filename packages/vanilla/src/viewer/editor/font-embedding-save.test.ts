/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file
   (many independent short-lived `const`s per test/helper, several separated
   by comments or guard clauses); merging them isn't a style choice here. */
/**
 * font-embedding-save.test.ts: File > Fonts > "Embed fonts in the file" must
 * change the bytes that get written.
 *
 * The toggle used to be a `private embedFontsEnabled` field on `PptxViewer`
 * that nothing downstream read, so flipping it produced a byte-identical file.
 * It now lives on `ViewerState`, is seeded per load from the deck's own
 * embedded fonts, and `ops.save()` forwards it to the shared
 * `embeddedFontSaveOptions`. This asserts the PACKAGE, not a spy: the
 * `p:embeddedFontLst` element, the `/font` relationships and the `.fntdata`
 * parts are all present with the toggle on and all gone with it off. A spy on
 * `handler.save` would have been satisfied by an option core ignored.
 */
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createLoadingController } from '../loading-controller';
import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { createEditorOps } from './editor-operations';

const FONT_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
const FONT_GUID = '11223344-5566-7788-99AA-BBCCDDEEFF00';
const FONT_PART = `fonts/{${FONT_GUID}}.fntdata`;

/**
 * A minimal sfnt-headed font blob, XOR-obfuscated the way ECMA-376 Part 2
 * 14.2.1 requires (first 32 bytes against the part-name GUID, repeated). The
 * loader rejects a part it cannot deobfuscate into a real font, so a fixture of
 * arbitrary bytes would never reach `PptxData.embeddedFonts` at all.
 *
 * The GUID-to-key conversion reverses the 16 bytes (see
 * `core/src/core/utils/font-deobfuscation.ts`'s `guidToKey`), matching real
 * PowerPoint-embedded fonts and docx4j's reference implementation; without
 * the reversal this fixture obfuscates against a key core will not
 * de-obfuscate back to a valid sfnt header.
 */
function obfuscatedFontPart(): Uint8Array {
	const font = new Uint8Array(64);
	font.set([0x00, 0x01, 0x00, 0x00]); // TrueType version 1.0.
	const hex = FONT_GUID.replace(/-/g, '').match(/../g)!;
	const key = Uint8Array.from(hex, (pair) => parseInt(pair, 16)).reverse();
	const part = new Uint8Array(font);
	for (let i = 0; i < 32; i++) {
		part[i] = font[i] ^ key[i % key.length];
	}
	return part;
}

/**
 * A one-slide deck, optionally carrying a real `p:embeddedFontLst`, a `/font`
 * relationship and a `.fntdata` part, assembled by editing a freshly saved
 * package (the recipe core's own embedded-font round-trip test uses).
 */
async function buildDeck(withFonts: boolean): Promise<ArrayBuffer> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		const zip = await JSZip.loadAsync(await handler.save(data.slides));
		if (withFonts) {
			const presentation = await zip.file('ppt/presentation.xml')!.async('string');
			zip.file(
				'ppt/presentation.xml',
				presentation.replace(
					'<p:defaultTextStyle>',
					'<p:embeddedFontLst><p:embeddedFont><p:font typeface="Brand Face" charset="1"/><p:regular r:id="rIdFont1"/></p:embeddedFont></p:embeddedFontLst><p:defaultTextStyle>',
				),
			);
			const rels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
			zip.file(
				'ppt/_rels/presentation.xml.rels',
				rels.replace(
					'</Relationships>',
					`<Relationship Id="rIdFont1" Type="${FONT_REL_TYPE}" Target="${FONT_PART}"/></Relationships>`,
				),
			);
			zip.file(`ppt/${FONT_PART}`, obfuscatedFontPart());
		}
		return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
	} finally {
		handler.dispose();
	}
}

interface LoadedViewer {
	store: Store<ViewerState>;
	save: (format?: 'pptx') => Promise<Uint8Array>;
	dispose: () => void;
}

/** Load `buffer` through the real loading controller into a real store. */
async function loadViewer(buffer: ArrayBuffer): Promise<LoadedViewer> {
	const store = createStore({ ...createInitialViewerState(), editable: true });
	const loading = createLoadingController({
		options: {},
		store,
		getTranslator: () => createTranslator(),
		getEditor: () => undefined,
	});
	await loading.load(buffer);
	const ops = createEditorOps({
		store,
		getHandler: () => loading.getHandler(),
		onHistoryChange: vi.fn(),
	});
	return { store, save: (format) => ops.save(format), dispose: () => loading.releaseLoaded() };
}

interface FontFootprint {
	presentation: string;
	rels: string;
	fontParts: string[];
}

async function fontFootprint(bytes: Uint8Array): Promise<FontFootprint> {
	const zip = await JSZip.loadAsync(bytes);
	return {
		presentation: await zip.file('ppt/presentation.xml')!.async('string'),
		rels: await zip.file('ppt/_rels/presentation.xml.rels')!.async('string'),
		fontParts: Object.keys(zip.files).filter((path) => path.endsWith('.fntdata')),
	};
}

describe('vanilla editor font embedding', () => {
	it('seeds the toggle on for an embedding deck and strips the fonts when it is off', async () => {
		const viewer = await loadViewer(await buildDeck(true));
		try {
			// Seeded from the deck, not hardcoded: save keeps these fonts, so the
			// switch has to start in the position that describes that.
			expect(viewer.store.get().embedFonts).toBeTruthy();

			const kept = await fontFootprint(await viewer.save('pptx'));
			expect(kept.presentation).toContain('embeddedFontLst');
			expect(kept.rels).toContain(FONT_REL_TYPE);
			expect(kept.fontParts.length).toBeGreaterThan(0);

			// Exactly what the dialog's `onToggle` now writes.
			viewer.store.set({ embedFonts: false });
			const stripped = await fontFootprint(await viewer.save('pptx'));
			expect(stripped.presentation).not.toContain('embeddedFontLst');
			expect(stripped.rels).not.toContain(FONT_REL_TYPE);
			expect(stripped.fontParts).toStrictEqual([]);
		} finally {
			viewer.dispose();
		}
	}, 60_000);

	it('seeds the toggle off for a deck that embeds nothing', async () => {
		const viewer = await loadViewer(await buildDeck(false));
		try {
			expect(viewer.store.get().embeddedFonts).toStrictEqual([]);
			expect(viewer.store.get().embedFonts).toBeFalsy();
		} finally {
			viewer.dispose();
		}
	}, 60_000);
});
