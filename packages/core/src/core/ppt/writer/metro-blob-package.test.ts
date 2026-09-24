/**
 * @module ppt/writer/metro-blob-package.test
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildMetroBlobPackage } from './metro-blob-package';
import { collectMetroParts } from './metro-blob-source';

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function rels(entries: Array<[string, string, string]>): string {
	const body = entries
		.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`)
		.join('');
	return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
}

/** A tiny source package: one chart (with an embedded workbook) and one SmartArt. */
function sourceZip(): JSZip {
	const zip = new JSZip();
	zip.file(
		'[Content_Types].xml',
		'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
			'<Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"/>' +
			'<Override PartName="/ppt/charts/chart1.xml" ContentType="chart+xml"/>' +
			'<Override PartName="/ppt/diagrams/data1.xml" ContentType="dgmData+xml"/>' +
			'<Override PartName="/ppt/diagrams/drawing1.xml" ContentType="dgmDrawing+xml"/></Types>',
	);
	zip.file(
		'ppt/slides/_rels/slide1.xml.rels',
		rels([
			['rId2', `${REL}/chart`, '../charts/chart1.xml'],
			['rId3', `${REL}/diagramData`, '../diagrams/data1.xml'],
			[
				'rId9',
				'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing',
				'../diagrams/drawing1.xml',
			],
		]),
	);
	zip.file('ppt/charts/chart1.xml', '<c:chartSpace/>');
	zip.file(
		'ppt/charts/_rels/chart1.xml.rels',
		rels([['rId1', `${REL}/package`, '../embeddings/book1.xlsx']]),
	);
	zip.file('ppt/embeddings/book1.xlsx', new Uint8Array([1, 2, 3]));
	zip.file(
		'ppt/diagrams/data1.xml',
		'<dgm:dataModel><dsp:dataModelExt relId="rId9"/></dgm:dataModel>',
	);
	zip.file('ppt/diagrams/drawing1.xml', '<dsp:drawing/>');
	return zip;
}

describe('collectMetroParts', () => {
	it('copies a chart and, recursively, its embedded workbook under drs/', async () => {
		const parts = await collectMetroParts(sourceZip(), 'ppt/slides/slide1.xml', ['rId2']);
		expect(parts?.rootRels).toStrictEqual([
			{ id: 'rId2', type: `${REL}/chart`, target: 'charts/chart1.xml', external: false },
		]);
		expect([...(parts?.parts.keys() ?? [])].sort()).toStrictEqual([
			'drs/charts/_rels/chart1.xml.rels',
			'drs/charts/chart1.xml',
			'drs/embeddings/book1.xlsx',
		]);
		expect(parts?.contentTypes.get('drs/embeddings/book1.xlsx')).toBe(
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
	});

	it("follows a SmartArt data part's dataModelExt relId to its pre-computed drawing", async () => {
		const parts = await collectMetroParts(sourceZip(), 'ppt/slides/slide1.xml', ['rId3']);
		expect(parts?.rootRels.map((r) => r.id)).toStrictEqual(['rId3', 'rId9']);
		expect(parts?.parts.has('drs/diagrams/drawing1.xml')).toBeTruthy();
	});

	it('refuses a dangling relationship rather than emit a broken package', async () => {
		await expect(
			collectMetroParts(sourceZip(), 'ppt/slides/slide1.xml', ['rId404']),
		).resolves.toBeUndefined();
	});
});

describe('buildMetroBlobPackage', () => {
	it('assembles the package PowerPoint reopens natively (root, rels, empty-checksum downrev)', async () => {
		const parts = await collectMetroParts(sourceZip(), 'ppt/slides/slide1.xml', ['rId2']);
		const bytes = await buildMetroBlobPackage({
			kind: 'graphicFrame',
			rootXml: '<p:E2oFrame xmlns:p="urn:p"/>',
			shapeId: '5',
			parts: parts!,
		});
		const zip = await JSZip.loadAsync(bytes);
		// No folder entries: an OPC package must not carry them.
		expect(Object.values(zip.files).some((f) => f.dir)).toBeFalsy();
		const rootRels = await zip.file('_rels/.rels')!.async('string');
		expect(rootRels).toContain('relationships/graphicFrameDoc" Target="drs/e2oDoc.xml"');
		expect(rootRels).toContain('relationships/downRev" Target="drs/downrev.xml"');
		const types = await zip.file('[Content_Types].xml')!.async('string');
		expect(types).toContain(
			'PartName="/drs/e2oDoc.xml" ContentType="application/vnd.ms-office.DrsE2oDoc+xml"',
		);
		expect(types).toContain('PartName="/drs/charts/chart1.xml" ContentType="chart+xml"');
		const downrev = await zip.file('drs/downrev.xml')!.async('string');
		expect(downrev).toContain('shapeCheckSum=""');
		expect(downrev).toContain('shapeId="5"');
		await expect(zip.file('drs/_rels/e2oDoc.xml.rels')!.async('string')).resolves.toContain(
			'Target="charts/chart1.xml"',
		);
	});

	it('roots ink at drs/inkxml.xml with the inkXml package relationship', async () => {
		const bytes = await buildMetroBlobPackage({
			kind: 'ink',
			rootXml: '<p:contentPart xmlns:p="urn:p"/>',
			parts: { rootRels: [], parts: new Map(), contentTypes: new Map() },
		});
		const zip = await JSZip.loadAsync(bytes);
		await expect(zip.file('_rels/.rels')!.async('string')).resolves.toContain(
			'office/2007/relationships/inkXml" Target="drs/inkxml.xml"',
		);
		expect(zip.file('drs/inkxml.xml')).not.toBeNull();
	});
});
