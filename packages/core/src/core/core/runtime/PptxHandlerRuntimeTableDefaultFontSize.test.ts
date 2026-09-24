/**
 * End-to-end coverage for item 3 of the table audit: a table cell's text
 * with no explicit `a:rPr@sz` (and no table-style size override - OOXML
 * table styles never carry one) must default to the slide master's
 * `p:otherStyle` size (ECMA-376 §19.3.1.42/§19.3.1.52), not a hardcoded
 * generic default. PowerPoint commonly sets this to 18pt; this viewer
 * previously left `PptxTableCellStyle.fontSize` unset in that case, which
 * rendered at the browser's own default font size (16px / 12pt) instead.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../PptxHandler';
import type { PptxData, TablePptxElement } from '../../types';

const OTHER_STYLE_PATTERN = /<p:otherStyle>[\s\S]*?<\/p:otherStyle>/u;
const OTHER_STYLE_WITH_SIZE =
	'<p:otherStyle>' +
	'<a:defPPr><a:defRPr lang="en-US"/></a:defPPr>' +
	'<a:lvl1pPr><a:defRPr sz="1800" kern="1200"/></a:lvl1pPr>' +
	'</p:otherStyle>';
const OTHER_STYLE_DEFPPR_ONLY_SIZE =
	'<p:otherStyle><a:defPPr><a:defRPr sz="2000" lang="en-US"/></a:defPPr></p:otherStyle>';

function findTable(data: PptxData): TablePptxElement {
	const el = data.slides[0]!.elements.find((e) => e.type === 'table');
	if (!el || el.type !== 'table') {
		throw new Error('table not found');
	}
	return el;
}

async function buildSeed(otherStyleXml: string | undefined): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create({ initialSlideCount: 0 });
	const slide = createSlide('Blank')
		.addTable({
			rows: [{ cells: [{ text: 'R1 C1' }, { text: 'R1 C2' }] }],
		})
		.build();
	data.slides.push(slide);
	const seed = await handler.save(data.slides);

	if (!otherStyleXml) {
		return seed.buffer.slice(seed.byteOffset, seed.byteOffset + seed.byteLength) as ArrayBuffer;
	}

	const zip = await JSZip.loadAsync(seed);
	const masterPath = 'ppt/slideMasters/slideMaster1.xml';
	const masterXml = await zip.file(masterPath)!.async('string');
	expect(masterXml).toMatch(OTHER_STYLE_PATTERN);
	zip.file(masterPath, masterXml.replace(OTHER_STYLE_PATTERN, otherStyleXml));

	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

describe('table cell default font size from master otherStyle (item 3)', () => {
	it('resolves defaultCellFontSize from otherStyle/a:lvl1pPr/a:defRPr@sz', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed(OTHER_STYLE_WITH_SIZE));
		const table = findTable(data);

		expect(table.tableData?.defaultCellFontSize).toBe(18);
	});

	it('falls back to a:defPPr/a:defRPr@sz when lvl1pPr sets no size', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed(OTHER_STYLE_DEFPPR_ONLY_SIZE));
		const table = findTable(data);

		expect(table.tableData?.defaultCellFontSize).toBe(20);
	});

	it('leaves defaultCellFontSize unset when otherStyle carries no size at all', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed(undefined));
		const table = findTable(data);

		expect(table.tableData?.defaultCellFontSize).toBeUndefined();
	});

	it('does not bake the resolved default into any individual cell style', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(await buildSeed(OTHER_STYLE_WITH_SIZE));
		const table = findTable(data);

		expect(table.tableData?.rows[0]!.cells[0]!.style?.fontSize).toBeUndefined();
	});
});
