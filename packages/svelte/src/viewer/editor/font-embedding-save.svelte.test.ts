/**
 * font-embedding-save.svelte.test.ts: File > Fonts > "Embed fonts in the file"
 * must change the bytes that get written.
 *
 * The toggle used to be a `$state(false)` local to `Ribbon.svelte`, so nothing
 * downstream could read it: moving it produced a byte-identical file. It now
 * lives on `EditorState` and `saveEditorDocument` forwards it to the shared
 * `embeddedFontSaveOptions`. This asserts the PACKAGE, not a spy: the
 * `p:embeddedFontLst` element, the `/font` relationships and the `.fntdata`
 * parts are all present with the toggle on and all gone with it off. A spy on
 * `handler.save` would have been satisfied by an option core ignored.
 */
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { EditorSnapshot } from './editor-document-state';
import { saveEditorDocument } from './editor-document-state';
import { EditorState } from './editor-state.svelte';

const FONT_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
const FONT_GUID = '11223344-5566-7788-99AA-BBCCDDEEFF00';
const FONT_PART = `fonts/{${FONT_GUID}}.fntdata`;

/**
 * A minimal sfnt-headed font blob, XOR-obfuscated the way ECMA-376 Part 2
 * 14.2.1 requires (first 32 bytes against the part-name GUID, repeated). The
 * loader rejects a part it cannot deobfuscate into a real font, so a fixture of
 * arbitrary bytes would never reach `PptxData.embeddedFonts` at all.
 */
function obfuscatedFontPart(): Uint8Array {
	const font = new Uint8Array(64);
	font.set([0x00, 0x01, 0x00, 0x00]); // TrueType version 1.0.
	const hex = FONT_GUID.replace(/-/g, '').match(/../g)!;
	const key = Uint8Array.from(hex, (pair) => parseInt(pair, 16));
	const part = new Uint8Array(font);
	for (let i = 0; i < 32; i++) {
		part[i] = font[i] ^ key[i % key.length];
	}
	return part;
}

/**
 * A one-slide deck carrying a real `p:embeddedFontLst`, a `/font` relationship
 * and a `.fntdata` part, assembled by editing a freshly saved package (the
 * recipe core's own embedded-font round-trip test uses).
 */
async function buildDeckWithEmbeddedFonts(): Promise<ArrayBuffer> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		const zip = await JSZip.loadAsync(await handler.save(data.slides));
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
		return (await zip.generateAsync({ type: 'uint8array' })).buffer as ArrayBuffer;
	} finally {
		handler.dispose();
	}
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

describe('saveEditorDocument font embedding', () => {
	it('keeps the embedded font data by default and strips it when the toggle is off', async () => {
		const handler = new PptxHandler();
		try {
			const data = await handler.load(await buildDeckWithEmbeddedFonts());
			// Guard the fixture itself: a part the loader rejects would leave
			// nothing to strip and both directions would agree for the wrong reason.
			expect(data.embeddedFonts?.map((font) => font.name)).toStrictEqual(['Brand Face']);
			const snapshot = emptySnapshot(data.slides);

			const kept = await fontFootprint(
				await saveEditorDocument(handler, snapshot, 'pptx', undefined, true),
			);
			expect(kept.presentation).toContain('embeddedFontLst');
			expect(kept.rels).toContain(FONT_REL_TYPE);
			expect(kept.fontParts.length).toBeGreaterThan(0);

			const stripped = await fontFootprint(
				await saveEditorDocument(handler, snapshot, 'pptx', undefined, false),
			);
			expect(stripped.presentation).not.toContain('embeddedFontLst');
			expect(stripped.rels).not.toContain(FONT_REL_TYPE);
			expect(stripped.fontParts).toStrictEqual([]);
		} finally {
			handler.dispose();
		}
	}, 30_000);
});

describe('editorState embed-fonts seeding', () => {
	function newEditor(): EditorState {
		return new EditorState({ getCurrent: () => 0, getHandler: () => null });
	}

	it('starts the toggle on for a deck that embeds fonts', () => {
		const editor = newEditor();
		editor.adoptEmbeddedFontFamilies(['Brand Face', 'Brand Face']);

		expect(editor.embedFonts).toBeTruthy();
		expect(editor.fontEmbedding).toMatchObject({
			embeddedFamilies: ['Brand Face'],
			interactive: true,
		});
	});

	it('reports the toggle inert, and off, for a deck that embeds nothing', () => {
		const editor = newEditor();
		editor.adoptEmbeddedFontFamilies(['Brand Face']);
		editor.adoptEmbeddedFontFamilies([]);

		expect(editor.embedFonts).toBeFalsy();
		expect(editor.fontEmbedding.interactive).toBeFalsy();
		expect(editor.fontEmbedding.disabledReasonKey).toBe('pptx.fonts.embedUnavailable');
	});
});
