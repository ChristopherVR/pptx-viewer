import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxElement, TablePptxElement, TextSegment } from '../../core/types';

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
const TABLE_MARKER = 'TABLEFIELDMARKER';
const SLIDE_TABLE_NAME = 'Inline order table';
const MASTER_TABLE_NAME = 'Master inline order table';
const LAYOUT_TABLE_NAME = 'Layout inline order table';
const RPR = '<a:rPr lang="en-US" sz="2000" dirty="0"/>';

/** `"Slide " #slidenum " - " #slidetitle`: literal / field / literal / field. */
const FIELD_RUNS =
	`<a:r>${RPR}<a:t>Slide </a:t></a:r>` +
	`<a:fld id="{AAAA0000-0000-4000-A000-000000000001}" type="slidenum">${RPR}<a:t>#</a:t></a:fld>` +
	`<a:r>${RPR}<a:t> - </a:t></a:r>` +
	`<a:fld id="{AAAA0000-0000-4000-A000-000000000002}" type="slidetitle">${RPR}<a:t>Title</a:t></a:fld>`;

const TABLE_FIELD_RUNS =
	`<a:r>${RPR}<a:t>Page </a:t></a:r>` +
	`<a:fld id="{BBBB0000-0000-4000-A000-000000000001}" type="slidenum">${RPR}<a:t>1</a:t></a:fld>` +
	`<a:r>${RPR}<a:t> of 10</a:t></a:r>`;

const STYLED_BREAK_RUNS =
	`<a:r>${RPR}<a:t>Before</a:t></a:r>` +
	`<a:br>${RPR}</a:br>` +
	`<a:r>${RPR}<a:t>After</a:t></a:r>`;

const IDENTICAL_TEXT_FIELD_RUNS =
	`<a:r>${RPR}<a:t>Same</a:t></a:r>` +
	`<a:fld id="{CCCC0000-0000-4000-A000-000000000001}" type="slidenum">${RPR}<a:t>Same</a:t></a:fld>` +
	`<a:r>${RPR}<a:t>Same</a:t></a:r>`;

/** Replace the whole marker run with the interleaved field runs. */
function spliceFields(slideXml: string): string {
	const markerRun = new RegExp(`<a:r>(?:(?!</a:r>).)*${MARKER}(?:(?!</a:r>).)*</a:r>`, 'su');
	expect(markerRun.test(slideXml)).toBeTruthy();
	return slideXml.replace(markerRun, FIELD_RUNS);
}

function spliceMarkerRun(xml: string, marker: string, replacement: string): string {
	const markerRun = new RegExp(`<a:r>(?:(?!</a:r>).)*${marker}(?:(?!</a:r>).)*</a:r>`, 'su');
	expect(markerRun.test(xml)).toBeTruthy();
	return xml.replace(markerRun, replacement);
}

function firstGraphicFrame(xml: string): string {
	const start = xml.indexOf('<p:graphicFrame');
	const end = xml.indexOf('</p:graphicFrame>', start);
	expect(start).toBeGreaterThan(-1);
	expect(end).toBeGreaterThan(start);
	return xml.slice(start, end + '</p:graphicFrame>'.length);
}

function withFrameIdentity(frame: string, id: string, name: string): string {
	return frame.replace(/<p:cNvPr\b[^>]*>/u, (tag) =>
		tag.replace(/\bid="[^"]*"/u, `id="${id}"`).replace(/\bname="[^"]*"/u, `name="${name}"`),
	);
}

function appendToShapeTree(partXml: string, frame: string): string {
	expect(partXml).toContain('</p:spTree>');
	return partXml.replace('</p:spTree>', `${frame}</p:spTree>`);
}

interface TableDeck {
	bytes: Uint8Array;
	masterPath?: string;
	layoutPath?: string;
}

async function buildTableDeck(
	content = TABLE_FIELD_RUNS,
	copyToTemplates = false,
): Promise<TableDeck> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({ initialSlideCount: 0 });
	try {
		data.slides.push(
			createSlide('Blank')
				.addTable(
					{ rows: [{ cells: [{ text: TABLE_MARKER }] }] },
					{ x: 60, y: 220, width: 600, height: 100 },
				)
				.build(),
		);
		if (copyToTemplates) {
			data.slides[0]!.notes = 'Speaker notes';
		}
		const zip = await JSZip.loadAsync(
			await handler.save(
				data.slides,
				copyToTemplates
					? {
							handoutMaster: { path: 'ppt/handoutMasters/handoutMaster1.xml' },
						}
					: undefined,
			),
		);
		const slidePath = 'ppt/slides/slide1.xml';
		let slideXml = spliceMarkerRun(
			await zip.file(slidePath)!.async('string'),
			TABLE_MARKER,
			content,
		);
		const originalFrame = firstGraphicFrame(slideXml);
		const slideFrame = withFrameIdentity(originalFrame, '8001', SLIDE_TABLE_NAME);
		slideXml = slideXml.replace(originalFrame, slideFrame);
		zip.file(slidePath, slideXml);

		if (!copyToTemplates) {
			return { bytes: await zip.generateAsync({ type: 'uint8array' }) };
		}

		const paths = Object.keys(zip.files);
		const masterPath = paths.find((path) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/u.test(path));
		const layoutPath = paths.find((path) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/u.test(path));
		expect(masterPath).toBeDefined();
		expect(layoutPath).toBeDefined();
		const masterFrame = withFrameIdentity(slideFrame, '8002', MASTER_TABLE_NAME);
		const layoutFrame = withFrameIdentity(slideFrame, '8003', LAYOUT_TABLE_NAME);
		zip.file(
			masterPath!,
			appendToShapeTree(await zip.file(masterPath!)!.async('string'), masterFrame),
		);
		zip.file(
			layoutPath!,
			appendToShapeTree(await zip.file(layoutPath!)!.async('string'), layoutFrame),
		);
		for (const [path, name] of [
			['ppt/notesMasters/notesMaster1.xml', 'Notes table'],
			['ppt/handoutMasters/handoutMaster1.xml', 'Handout table'],
		]) {
			zip.file(
				path,
				appendToShapeTree(
					await zip.file(path)!.async('string'),
					withFrameIdentity(slideFrame, '8004', name),
				),
			);
		}
		return {
			bytes: await zip.generateAsync({ type: 'uint8array' }),
			masterPath,
			layoutPath,
		};
	} finally {
		handler.dispose();
	}
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function tableByName(elements: PptxElement[] | undefined, name: string): TablePptxElement {
	const table = elements?.find((element) => element.type === 'table' && element.name === name);
	expect(table?.type).toBe('table');
	return table as TablePptxElement;
}

function tableParagraphTags(partXml: string, tableName: string): string[] {
	const nameAt = partXml.indexOf(`name="${tableName}"`);
	const frameStart = partXml.lastIndexOf('<p:graphicFrame', nameAt);
	const frameEnd = partXml.indexOf('</p:graphicFrame>', nameAt);
	expect(nameAt).toBeGreaterThan(-1);
	expect(frameStart).toBeGreaterThan(-1);
	expect(frameEnd).toBeGreaterThan(nameAt);
	const frame = partXml.slice(frameStart, frameEnd);
	const paragraphStart = frame.search(/<a:p(?=[\s>])/u);
	const paragraphEnd = frame.indexOf('</a:p>', paragraphStart);
	expect(paragraphStart).toBeGreaterThan(-1);
	expect(paragraphEnd).toBeGreaterThan(paragraphStart);
	const paragraph = frame.slice(paragraphStart, paragraphEnd);
	return [...paragraph.matchAll(/<(a:(?:r|br|fld))(?=[\s/>])/gu)].map((match) => match[1]!);
}

async function loadTableDeck(deck: TableDeck): Promise<{ handler: PptxHandler; data: PptxData }> {
	const handler = new PptxHandler();
	return { handler, data: await handler.load(arrayBuffer(deck.bytes)) };
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

	it('keeps an untouched table ordered through the no-op save fast path', async () => {
		const deck = await buildTableDeck();
		const { handler, data } = await loadTableDeck(deck);
		try {
			const saved = await JSZip.loadAsync(await handler.save(data.slides));
			const xml = await saved.file('ppt/slides/slide1.xml')!.async('string');
			expect(tableParagraphTags(xml, SLIDE_TABLE_NAME)).toStrictEqual(['a:r', 'a:fld', 'a:r']);
		} finally {
			handler.dispose();
		}
	});

	it('keeps literal / field / literal order when only the table is moved', async () => {
		const { handler, data } = await loadTableDeck(await buildTableDeck());
		try {
			tableByName(data.slides[0]!.elements, SLIDE_TABLE_NAME).x += 10;
			const saved = await JSZip.loadAsync(await handler.save(data.slides));
			const xml = await saved.file('ppt/slides/slide1.xml')!.async('string');
			expect(tableParagraphTags(xml, SLIDE_TABLE_NAME)).toStrictEqual(['a:r', 'a:fld', 'a:r']);
			expect(xml).not.toContain('#pptx-order-');
		} finally {
			handler.dispose();
		}
	});

	it('keeps a styled soft break between its surrounding runs on a dirty slide', async () => {
		const { handler, data } = await loadTableDeck(await buildTableDeck(STYLED_BREAK_RUNS));
		try {
			tableByName(data.slides[0]!.elements, SLIDE_TABLE_NAME).x += 10;
			const saved = await JSZip.loadAsync(await handler.save(data.slides));
			const xml = await saved.file('ppt/slides/slide1.xml')!.async('string');
			expect(tableParagraphTags(xml, SLIDE_TABLE_NAME)).toStrictEqual(['a:r', 'a:br', 'a:r']);
		} finally {
			handler.dispose();
		}
	});

	it('keeps field order when only the cell fill is edited', async () => {
		const { handler, data } = await loadTableDeck(await buildTableDeck());
		try {
			const cell = tableByName(data.slides[0]!.elements, SLIDE_TABLE_NAME).tableData!.rows[0]!
				.cells[0]!;
			cell.style = { ...cell.style, fillMode: 'solid', backgroundColor: '#AABBCC' };
			const saved = await JSZip.loadAsync(await handler.save(data.slides));
			const xml = await saved.file('ppt/slides/slide1.xml')!.async('string');
			expect(tableParagraphTags(xml, SLIDE_TABLE_NAME)).toStrictEqual(['a:r', 'a:fld', 'a:r']);
			expect(xml).toContain('<a:srgbClr val="AABBCC"');
		} finally {
			handler.dispose();
		}
	});

	it('stays ordered across two dirty saves through the same handler', async () => {
		const { handler, data } = await loadTableDeck(await buildTableDeck());
		try {
			const table = tableByName(data.slides[0]!.elements, SLIDE_TABLE_NAME);
			table.x += 10;
			await handler.save(data.slides);
			table.x += 10;
			const saved = await JSZip.loadAsync(await handler.save(data.slides));
			const xml = await saved.file('ppt/slides/slide1.xml')!.async('string');
			expect(tableParagraphTags(xml, SLIDE_TABLE_NAME)).toStrictEqual(['a:r', 'a:fld', 'a:r']);
			expect(xml).not.toContain('#pptx-order-');
		} finally {
			handler.dispose();
		}
	});

	it('recovers table order after a non-structural rawXml clone', async () => {
		const { handler, data } = await loadTableDeck(await buildTableDeck());
		try {
			const table = tableByName(data.slides[0]!.elements, SLIDE_TABLE_NAME);
			table.rawXml = structuredClone(table.rawXml);
			table.y += 10;
			const saved = await JSZip.loadAsync(await handler.save(data.slides));
			const xml = await saved.file('ppt/slides/slide1.xml')!.async('string');
			expect(tableParagraphTags(xml, SLIDE_TABLE_NAME)).toStrictEqual(['a:r', 'a:fld', 'a:r']);
		} finally {
			handler.dispose();
		}
	});

	it('uses run kind, not text matching, when literal and field text are identical', async () => {
		const { handler, data } = await loadTableDeck(await buildTableDeck(IDENTICAL_TEXT_FIELD_RUNS));
		try {
			tableByName(data.slides[0]!.elements, SLIDE_TABLE_NAME).x += 10;
			const saved = await JSZip.loadAsync(await handler.save(data.slides));
			const xml = await saved.file('ppt/slides/slide1.xml')!.async('string');
			expect(tableParagraphTags(xml, SLIDE_TABLE_NAME)).toStrictEqual(['a:r', 'a:fld', 'a:r']);
		} finally {
			handler.dispose();
		}
	});

	it('still replaces a field with one plain run after a genuine cell text edit', async () => {
		const { handler, data } = await loadTableDeck(await buildTableDeck());
		try {
			const table = tableByName(data.slides[0]!.elements, SLIDE_TABLE_NAME);
			const cell = table.tableData!.rows[0]!.cells[0]!;
			cell.text = 'Plain replacement';
			table.x += 10;
			const saved = await JSZip.loadAsync(await handler.save(data.slides));
			const xml = await saved.file('ppt/slides/slide1.xml')!.async('string');
			expect(tableParagraphTags(xml, SLIDE_TABLE_NAME)).toStrictEqual(['a:r']);
			expect(xml).toContain('Plain replacement');
			expect(xml).not.toContain('type="slidenum"');
		} finally {
			handler.dispose();
		}
	});

	it.each([
		['the template data is passed back unchanged', false],
		['only master and layout backgrounds are edited', true],
	] as const)('keeps untouched table order when %s', async (_scenario, editBackgrounds) => {
		const deck = await buildTableDeck(TABLE_FIELD_RUNS, true);
		const { handler, data } = await loadTableDeck(deck);
		try {
			const master = data.slideMasters!.find((entry) => entry.path === deck.masterPath)!;
			const layout = data
				.slideMasters!.flatMap((entry) => entry.layouts ?? [])
				.find((entry) => entry.path === deck.layoutPath)!;
			if (editBackgrounds) {
				master.backgroundColor = '#AABBCC';
				layout.backgroundColor = '#DDEEFF';
			}
			const saved = await JSZip.loadAsync(
				await handler.save(data.slides, { slideMasters: data.slideMasters }),
			);
			expect({
				master: tableParagraphTags(
					await saved.file(deck.masterPath!)!.async('string'),
					MASTER_TABLE_NAME,
				),
				layout: tableParagraphTags(
					await saved.file(deck.layoutPath!)!.async('string'),
					LAYOUT_TABLE_NAME,
				),
			}).toStrictEqual({
				master: ['a:r', 'a:fld', 'a:r'],
				layout: ['a:r', 'a:fld', 'a:r'],
			});
		} finally {
			handler.dispose();
		}
	});

	it.each([
		['notesMaster', 'ppt/notesMasters/notesMaster1.xml', 'Notes table'],
		['handoutMaster', 'ppt/handoutMasters/handoutMaster1.xml', 'Handout table'],
	] as const)(
		'keeps an untouched table ordered for a partial %s background edit',
		async (kind, path, name) => {
			const { handler, data } = await loadTableDeck(await buildTableDeck(TABLE_FIELD_RUNS, true));
			try {
				const saved = await JSZip.loadAsync(
					await handler.save(data.slides, {
						[kind]: { path, backgroundColor: '#AABBCC' },
					}),
				);
				const xml = await saved.file(path)!.async('string');
				expect(tableParagraphTags(xml, name)).toStrictEqual(['a:r', 'a:fld', 'a:r']);
				expect(xml).toContain('AABBCC');
			} finally {
				handler.dispose();
			}
		},
	);

	it('keeps table field order when edited master and layout parts are saved', async () => {
		const deck = await buildTableDeck(TABLE_FIELD_RUNS, true);
		const { handler, data } = await loadTableDeck(deck);
		try {
			const master = data.slideMasters!.find((entry) => entry.path === deck.masterPath)!;
			const layout = data
				.slideMasters!.flatMap((entry) => entry.layouts ?? [])
				.find((entry) => entry.path === deck.layoutPath)!;
			tableByName(master.elements, MASTER_TABLE_NAME).x += 10;
			tableByName(layout.elements, LAYOUT_TABLE_NAME).x += 10;
			const saved = await JSZip.loadAsync(
				await handler.save(data.slides, { slideMasters: data.slideMasters }),
			);
			const sequences = {
				master: tableParagraphTags(
					await saved.file(deck.masterPath!)!.async('string'),
					MASTER_TABLE_NAME,
				),
				layout: tableParagraphTags(
					await saved.file(deck.layoutPath!)!.async('string'),
					LAYOUT_TABLE_NAME,
				),
			};
			expect(sequences).toStrictEqual({
				master: ['a:r', 'a:fld', 'a:r'],
				layout: ['a:r', 'a:fld', 'a:r'],
			});
		} finally {
			handler.dispose();
		}
	});
});
