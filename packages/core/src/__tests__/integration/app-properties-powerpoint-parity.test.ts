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

	it.each(['solution-explorer.pptx', 'table-row-autogrow.pptx', 'header-footer-shows.pptx'])(
		'recomputes Words and Paragraphs to the values PowerPoint wrote for %s',
		async (name) => {
			// Each of these was last saved by PowerPoint, so its own counts are
			// the ground truth a rewrite of every slide must reproduce.
			const { before, after } = await roundTripAppXml(name);
			const stat = (xml: string, tag: string): string | undefined =>
				new RegExp(`<${tag}>(\\d+)</${tag}>`).exec(xml)?.[1];
			expect(stat(after, 'Words')).toBe(stat(before, 'Words'));
			expect(stat(after, 'Paragraphs')).toBe(stat(before, 'Paragraphs'));
		},
	);

	it('recomputes Words and Paragraphs after a text edit', async () => {
		const source = readFileSync(fixturePath('header-footer-shows.pptx'));
		const handler = new PptxHandler();
		const data = await handler.load(new Uint8Array(source));
		const before = await (await JSZip.loadAsync(source)).file('docProps/app.xml')!.async('string');
		const words = Number(/<Words>(\d+)<\/Words>/.exec(before)?.[1]);
		const paragraphs = Number(/<Paragraphs>(\d+)<\/Paragraphs>/.exec(before)?.[1]);
		const target = data.slides[0]!.elements.find(
			(element) => 'text' in element && typeof element.text === 'string' && element.text.length > 0,
		);
		if (!target || !('text' in target)) {
			throw new Error('fixture has no text element on slide 1');
		}
		const original = target.text ?? '';
		const originalWords = original.trim().length === 0 ? 0 : original.split(/\s+/).length;
		target.text = 'three new words';
		target.textSegments = undefined;
		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);
		const after = await (await JSZip.loadAsync(saved)).file('docProps/app.xml')!.async('string');
		expect(original).not.toContain('\n');
		expect(after).toContain(`<Words>${words - originalWords + 3}</Words>`);
		expect(after).toContain(`<Paragraphs>${paragraphs}</Paragraphs>`);
	});

	it('keeps "PowerPoint Presentation" for an untitled slide', async () => {
		const { before, after } = await roundTripAppXml('comment-mentions.pptx');
		expect(lpstrs(before)).toContain('PowerPoint Presentation');
		expect(lpstrs(after)).toStrictEqual(lpstrs(before));
	});
});
