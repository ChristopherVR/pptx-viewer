import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { TextSegment } from '../../core/types';

/**
 * Integration: an OOXML field authored INSIDE a sentence must load, and save,
 * at the position it was authored in.
 *
 * fast-xml-parser collapses same-tag siblings under one key, so a paragraph
 * written as `"Slide " <a:fld slidenum/> " - " <a:fld slidetitle/>` parsed as
 * both literal runs followed by both fields, and the save path re-grouped it
 * the same way. On screen that reads "Slide - 1Alpha" instead of
 * "Slide 1 - Alpha", and the corruption is then written back into the file.
 * Every deck with an inline field ("Page X of Y", a date inside a sentence, a
 * footer with text either side of the field) was affected, in all five
 * bindings, because the defect is in the shared load/save pipeline.
 */

const MARKER = 'FIELDMARKER';
const RPR = '<a:rPr lang="en-US" sz="2000" dirty="0"/>';

/** `"Slide " #slidenum " - " #slidetitle`: literal / field / literal / field. */
const FIELD_RUNS =
	`<a:r>${RPR}<a:t>Slide </a:t></a:r>` +
	`<a:fld id="{AAAA0000-0000-4000-A000-000000000001}" type="slidenum">${RPR}<a:t>#</a:t></a:fld>` +
	`<a:r>${RPR}<a:t> - </a:t></a:r>` +
	`<a:fld id="{AAAA0000-0000-4000-A000-000000000002}" type="slidetitle">${RPR}<a:t>Title</a:t></a:fld>`;

/** Replace the whole marker run with the interleaved field runs. */
function spliceFields(slideXml: string): string {
	const markerRun = new RegExp(`<a:r>(?:(?!</a:r>).)*${MARKER}(?:(?!</a:r>).)*</a:r>`, 'su');
	expect(markerRun.test(slideXml)).toBeTruthy();
	return slideXml.replace(markerRun, FIELD_RUNS);
}

/** Build a one-slide deck whose only text shape holds the interleaved runs. */
async function buildDeckWithInlineFields(): Promise<Uint8Array> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Inline field position',
		initialSlideCount: 0,
	});
	data.slides.push(
		createSlide('Title and Content')
			.addText(MARKER, { x: 60, y: 300, width: 600, height: 60, fontSize: 20 })
			.build(),
	);
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	const path = 'ppt/slides/slide1.xml';
	zip.file(path, spliceFields(await zip.file(path)!.async('string')));
	return zip.generateAsync({ type: 'uint8array' });
}

/** `[text, fieldType]` pairs for the one element that carries field runs. */
function fieldSegments(segments: TextSegment[] | undefined): Array<[string, string | undefined]> {
	return (segments ?? []).map((segment) => [segment.text, segment.fieldType]);
}

describe('inline field position round-trip', () => {
	it.each(['text', 'table'] as const)(
		'loads soft line breaks in %s content through the runtime parser',
		async (kind) => {
			const cases = [
				{ content: '<a:br/>', expected: ['<br>'] },
				{ content: '<a:br/><a:r><a:t>After</a:t></a:r>', expected: ['<br>', 'After'] },
				{
					content: '<a:r><a:t>Before</a:t></a:r><a:br/><a:r><a:t>After</a:t></a:r>',
					expected: ['Before', '<br>', 'After'],
				},
				{ content: '<a:r><a:t>Before</a:t></a:r><a:br/>', expected: ['Before', '<br>'] },
				{
					content: '<a:r><a:t>Before</a:t></a:r><a:br/><a:br/><a:r><a:t>After</a:t></a:r>',
					expected: ['Before', '<br>', '<br>', 'After'],
				},
				{
					content:
						'<a:r><a:t>Before</a:t></a:r><a:br><a:rPr lang="en-US"/></a:br><a:r><a:t>After</a:t></a:r>',
					expected: ['Before', '<br>', 'After'],
				},
				{
					content: '<a:r><a:t>Before</a:t></a:r><a:r><a:t>After</a:t></a:r>',
					expected: ['Before', 'After'],
				},
			];
			for (const { content, expected } of cases) {
				const {
					handler: creator,
					data,
					createSlide,
				} = await PptxHandler.createBlank({
					initialSlideCount: 0,
				});
				const slide = createSlide('Blank');
				const bounds = { x: 60, y: 60, width: 500, height: 160 };
				if (kind === 'table') {
					slide.addTable({ rows: [{ cells: [{ text: MARKER }] }] }, bounds);
				} else {
					slide.addText(MARKER, bounds);
				}
				data.slides.push(slide.build());
				const reader = new PptxHandler();
				try {
					const zip = await JSZip.loadAsync(await creator.save(data.slides));
					const path = 'ppt/slides/slide1.xml';
					const xml = await zip.file(path)!.async('string');
					const markerRun = new RegExp(
						`<a:r>(?:(?!</a:r>).)*${MARKER}(?:(?!</a:r>).)*</a:r>`,
						'su',
					);
					expect(xml).toMatch(markerRun);
					zip.file(path, xml.replace(markerRun, content));
					const bytes = await zip.generateAsync({ type: 'uint8array' });
					const loaded = await reader.load(bytes.buffer as ArrayBuffer);
					const element = loaded.slides[0].elements.find((candidate) =>
						kind === 'table'
							? candidate.type === 'table'
							: candidate.type === 'text' || candidate.type === 'shape',
					)!;
					const runs =
						element.type === 'table'
							? element.tableData!.rows[0].cells[0].textRuns
							: element.textSegments;
					expect(
						runs
							?.filter((run) => !run.isParagraphBreak)
							.map((run) => (run.isLineBreak ? '<br>' : run.text)),
					).toStrictEqual(expected);
				} finally {
					creator.dispose();
					reader.dispose();
				}
			}
		},
	);

	it('loads and saves an inline a:fld at its authored position', async () => {
		const bytes = await buildDeckWithInlineFields();
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);

		const element = data.slides[0]!.elements.find((candidate) =>
			(candidate.textSegments ?? []).some((segment) => segment.fieldType),
		);
		expect(fieldSegments(element?.textSegments)).toStrictEqual([
			['Slide ', undefined],
			['#', 'slidenum'],
			[' - ', undefined],
			['Title', 'slidetitle'],
		]);

		// And the save path must not re-group what the load path just fixed.
		const saved = await JSZip.loadAsync(await handler.save(data.slides));
		const xml = await saved.file('ppt/slides/slide1.xml')!.async('string');
		const at = (needle: string): number => {
			const index = xml.indexOf(needle);
			expect(index).toBeGreaterThan(-1);
			return index;
		};
		expect(at('Slide ')).toBeLessThan(at('type="slidenum"'));
		expect(at('type="slidenum"')).toBeLessThan(at(' - '));
		expect(at(' - ')).toBeLessThan(at('type="slidetitle"'));
		// The internal ordering markers are never allowed into the file.
		expect(xml).not.toContain('#pptx-order-');
	});
});
