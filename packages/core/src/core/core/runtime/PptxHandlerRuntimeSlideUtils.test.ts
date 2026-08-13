import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { requireFixture } from '../../../__tests__/require-fixture';
import { PptxHandler } from '../../PptxHandler';

/**
 * `extractSlideNotes` used to merge the text of EVERY shape on a notes page
 * into `slide.notes`, including the `sldNum` placeholder. Slides 12-14 of
 * `solution-explorer.pptx` have empty speaker notes and a slide-number field,
 * so they loaded as `notes === "12" | "13" | "14"`, and the save side wrote
 * that string into the notes BODY. PowerPoint COM confirmed it on the saved
 * file: `NotesPage.Shapes(2).TextFrame.TextRange.Text === "12"` for a slide
 * whose notes nobody had ever typed into.
 */
const fixturePath = requireFixture(
	fileURLToPath(new URL('../../../../../../e2e/fixtures/solution-explorer.pptx', import.meta.url)),
);

const NOTES_PART = 'ppt/notesSlides/notesSlide1.xml';
/** The empty body placeholder of `notesSlide1.xml`, verbatim. */
const EMPTY_BODY_PARAGRAPH =
	'<a:p><a:pPr marL="0" marR="0" lvl="0" indent="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" fontAlgn="auto" latinLnBrk="0" hangingPunct="1"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="0"/></a:spcAft><a:buClrTx/><a:buSzTx/><a:buFontTx/><a:buNone/><a:tabLst/><a:defRPr/></a:pPr><a:endParaRPr lang="en-GB" dirty="0"/></a:p>';

function readFixtureBuffer(): ArrayBuffer {
	const bytes = readFileSync(fixturePath);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Re-pack the fixture with `notesSlide1.xml` rewritten by `mutate`. */
async function fixtureWithRewrittenNotes(
	mutate: (notesXml: string) => string,
): Promise<ArrayBuffer> {
	const zip = await JSZip.loadAsync(readFixtureBuffer());
	const notesXml = await zip.file(NOTES_PART)!.async('string');
	zip.file(NOTES_PART, mutate(notesXml));
	const rebuilt = await zip.generateAsync({ type: 'uint8array' });
	return rebuilt.buffer.slice(
		rebuilt.byteOffset,
		rebuilt.byteOffset + rebuilt.byteLength,
	) as ArrayBuffer;
}

/** Text of every `p:sp` in a notes part, keyed by its placeholder type. */
async function notesTextByPlaceholder(
	saved: Uint8Array,
	part: string,
): Promise<Record<string, string>> {
	const zip = await JSZip.loadAsync(saved);
	const xml = await zip.file(part)!.async('string');
	const byType: Record<string, string> = {};
	for (const shape of xml.split('<p:sp>').slice(1)) {
		const placeholder = /<p:ph([^>]*)\/?>/u.exec(shape);
		const type = placeholder ? (/type="([^"]+)"/u.exec(placeholder[1])?.[1] ?? 'body') : 'none';
		byType[type] = [...shape.matchAll(/<a:t>([\s\S]*?)<\/a:t>/gu)].map((m) => m[1]).join('');
	}
	return byType;
}

describe('extractSlideNotes: only the notes BODY placeholder is speaker notes', () => {
	it('leaves notes undefined for slides whose notes page is empty', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(readFixtureBuffer());

		// Slides 12, 13 and 14 are the three with a notes part; all are empty.
		for (const slideNumber of [12, 13, 14] as const) {
			const slide = data.slides[slideNumber - 1];
			expect(slide.id).toBe(`ppt/slides/slide${slideNumber}.xml`);
			expect(slide.notes).toBeUndefined();
			expect(slide.notesSegments ?? []).toStrictEqual([]);
		}
	});

	it('does not write the slide number into the notes body on save', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(readFixtureBuffer());
		const saved = await handler.save(data.slides);

		const byType = await notesTextByPlaceholder(saved, NOTES_PART);
		expect(byType['sldNum']).toBe('12');
		expect(byType['body']).toBe('');
	});

	it('preserves a note whose real text is the slide number', async () => {
		// Filtering by placeholder type rather than by content is what makes
		// this work: "12" as authored notes is indistinguishable from "12" as
		// the slide-number field if you only look at the string.
		const buffer = await fixtureWithRewrittenNotes((xml) =>
			xml.replace(EMPTY_BODY_PARAGRAPH, '<a:p><a:r><a:rPr lang="en-GB"/><a:t>12</a:t></a:r></a:p>'),
		);
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		expect(data.slides[11].notes).toBe('12');

		const saved = await handler.save(data.slides);
		const byType = await notesTextByPlaceholder(saved, NOTES_PART);
		expect(byType['body']).toBe('12');
	});

	it('does not absorb the date, header or footer placeholders either', async () => {
		const field = (type: string, id: number, text: string): string =>
			`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${type} Placeholder"/><p:cNvSpPr>` +
			`<a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="${type}" sz="quarter" ` +
			`idx="${id}"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>` +
			`<a:p><a:r><a:rPr lang="en-GB"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
		const buffer = await fixtureWithRewrittenNotes((xml) =>
			xml.replace(
				'</p:spTree>',
				`${field('dt', 21, '13/08/2026')}${field('hdr', 22, 'Confidential')}` +
					`${field('ftr', 23, 'Acme Corp')}</p:spTree>`,
			),
		);
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		expect(data.slides[11].notes).toBeUndefined();
	});

	it('still reads notes from a page whose body text box has no placeholder', async () => {
		const buffer = await fixtureWithRewrittenNotes((xml) =>
			// Strip the body placeholder marker so the shape becomes a plain
			// text box, and give it text. The fallback must still find it.
			xml
				.replace('<p:ph type="body" idx="1"/>', '')
				.replace(
					EMPTY_BODY_PARAGRAPH,
					'<a:p><a:r><a:rPr lang="en-GB"/><a:t>Say this</a:t></a:r></a:p>',
				),
		);
		const handler = new PptxHandler();
		const data = await handler.load(buffer);
		expect(data.slides[11].notes).toBe('Say this');
	});
});
