/**
 * `docProps/app.xml` is refreshed on every save, and it should be refreshed
 * the way PowerPoint refreshes it. Measured over COM (PowerPoint 16.0: an
 * open / edit / `Save` of a PowerPoint-authored deck, and a
 * `Presentations.Add` deck with blank, empty-title, titled and notes slides):
 *
 * - `Notes` counts slides that have a notes PAGE, empty or not. The writer
 *   counted slides with non-empty notes TEXT, so a deck whose notes page is
 *   empty went from `<Notes>1</Notes>` to 0.
 * - A slide with no title text is listed as "PowerPoint Presentation" in
 *   `TitlesOfParts`; the writer blanked those entries to an empty
 *   `vt:lpstr`.
 *
 * `cp:revision` +1 and a fresh `dcterms:modified` are what PowerPoint does
 * too, so those are not asserted away here.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const fixturePath = (name: string): string =>
	fileURLToPath(new URL(`../../../../../e2e/fixtures/${name}`, import.meta.url));

async function roundTripAppXml(name: string): Promise<{ before: string; after: string }> {
	const source = readFileSync(fixturePath(name));
	const handler = new PptxHandler();
	const data = await handler.load(new Uint8Array(source));
	for (const slide of data.slides) {
		slide.isDirty = true;
	}
	const saved = await handler.save(data.slides);
	const read = async (bytes: Uint8Array): Promise<string> =>
		(await JSZip.loadAsync(bytes)).file('docProps/app.xml')!.async('string');
	return { before: await read(new Uint8Array(source)), after: await read(saved) };
}

const lpstrs = (xml: string): string[] =>
	[...xml.matchAll(/<vt:lpstr>([^<]*)<\/vt:lpstr>/g)].map((m) => m[1]!);

describe('docProps/app.xml is refreshed the way PowerPoint refreshes it', () => {
	it('counts an empty notes page toward Notes', async () => {
		const { before, after } = await roundTripAppXml('issue-132-gradient-fill.pptx');
		expect(before).toContain('<Notes>1</Notes>');
		expect(after).toContain('<Notes>1</Notes>');
	});

	it('keeps "PowerPoint Presentation" for an untitled slide', async () => {
		const { before, after } = await roundTripAppXml('comment-mentions.pptx');
		expect(lpstrs(before)).toContain('PowerPoint Presentation');
		expect(lpstrs(after)).toStrictEqual(lpstrs(before));
	});
});
