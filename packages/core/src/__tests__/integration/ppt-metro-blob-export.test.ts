/**
 * `.ppt` export of ink, SmartArt, charts and 3D models as native objects: each is
 * written with a `metroBlob` (the OOXML round-trip package in an
 * `OfficeArtTertiaryFOPT`, opid 0x03A9) that PowerPoint 2007+ reopens as an
 * editable object. The reopen itself needs real PowerPoint and was verified
 * over COM (ink `Shape.Type` = 23/msoInk, SmartArt `HasSmartArt` with the
 * same 11 nodes and layout, chart `HasChart` with the same type, title and
 * values, 3D model `Shape.Type` = 30/msoModel3D); this test pins the bytes
 * that verification depends on.
 *
 * @module __tests__/integration/ppt-metro-blob-export.test
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types';
import { parseOle2 } from '../../core/utils/ole2-parser-read';

const E2E = path.resolve(__dirname, '../../../../../e2e/fixtures');
const CORPUS = path.resolve(__dirname, '../fixtures/corpus');

/** Every metroBlob payload in a `.ppt` "PowerPoint Document" stream. */
function metroBlobs(ppt: Uint8Array): Uint8Array[] {
	const ole = parseOle2(
		ppt.buffer.slice(ppt.byteOffset, ppt.byteOffset + ppt.byteLength) as ArrayBuffer,
	);
	const doc = ole.getStream('PowerPoint Document')!;
	const view = new DataView(doc.buffer, doc.byteOffset, doc.byteLength);
	const out: Uint8Array[] = [];
	const walk = (start: number, end: number): void => {
		let o = start;
		while (o + 8 <= end) {
			const ver = view.getUint16(o, true) & 0xf;
			const count = view.getUint16(o, true) >> 4;
			const type = view.getUint16(o + 2, true);
			const len = view.getUint32(o + 4, true);
			if (ver === 0xf) {
				walk(o + 8, o + 8 + len);
			} else if (type === 0xf122) {
				let payload = o + 8 + count * 6;
				for (let i = 0; i < count; i++) {
					const id = view.getUint16(o + 8 + i * 6, true);
					const size = view.getUint32(o + 10 + i * 6, true);
					if (id & 0x8000) {
						if ((id & 0x3fff) === 0x3a9) {
							out.push(doc.subarray(payload, payload + size));
						}
						payload += size;
					}
				}
			}
			o += 8 + len;
		}
	};
	walk(0, doc.length);
	return out;
}

async function exportPpt(file: string): Promise<Uint8Array> {
	const buf = readFileSync(file);
	const handler = new PptxHandler();
	const data = await handler.load(
		buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
	);
	const bytes = await handler.save(data.slides, { outputFormat: 'ppt' });
	const warnings = handler.getCompatibilityWarnings();
	expect(warnings.some((w) => w.code.startsWith('ppt-native-roundtrip-'))).toBeTruthy();
	return bytes;
}

async function rootRelTypes(blob: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(blob);
	return zip.file('_rels/.rels')!.async('string');
}

describe('.ppt export: metroBlob round-trip packages', () => {
	it('carries each ink content part as a drs/inkxml.xml package with its InkML', async () => {
		const blobs = metroBlobs(await exportPpt(path.join(E2E, 'ink-contentpart.pptx')));
		expect(blobs).toHaveLength(2);
		const zip = await JSZip.loadAsync(blobs[0]!);
		await expect(rootRelTypes(blobs[0]!)).resolves.toContain('relationships/inkXml');
		await expect(zip.file('drs/inkxml.xml')!.async('string')).resolves.toContain('<p:contentPart');
		await expect(zip.file('drs/ink/ink1.xml')!.async('string')).resolves.toContain('<inkml:ink');
		await expect(zip.file('drs/downrev.xml')!.async('string')).resolves.toContain(
			'shapeCheckSum=""',
		);
	}, 60_000);

	it('carries a SmartArt diagram as an E2oFrame with all five diagram parts', async () => {
		const blobs = metroBlobs(await exportPpt(path.join(CORPUS, 'smartart-orgchart-many.pptx')));
		expect(blobs).toHaveLength(1);
		const zip = await JSZip.loadAsync(blobs[0]!);
		await expect(rootRelTypes(blobs[0]!)).resolves.toContain('relationships/graphicFrameDoc');
		await expect(zip.file('drs/e2oDoc.xml')!.async('string')).resolves.toContain('<p:E2oFrame');
		const names = Object.keys(zip.files).filter((n) => n.startsWith('drs/diagrams/'));
		for (const part of ['data', 'layout', 'quickStyle', 'colors', 'drawing']) {
			expect(names.some((n) => n.startsWith(`drs/diagrams/${part}`))).toBeTruthy();
		}
	}, 60_000);

	it('carries a chart as an E2oFrame with its chart part', async () => {
		const blobs = metroBlobs(await exportPpt(path.join(E2E, 'chart-title-runs.pptx')));
		expect(blobs).toHaveLength(1);
		const zip = await JSZip.loadAsync(blobs[0]!);
		const frame = await zip.file('drs/e2oDoc.xml')!.async('string');
		expect(frame).toContain('drawingml/2006/chart');
		expect(
			Object.keys(zip.files).some((n) => /^drs\/charts\/chart\d+\.xml$/u.test(n)),
		).toBeTruthy();
	}, 60_000);

	it('synthesises a 3D model as an am3d E2oFrame with its .glb and poster', async () => {
		const { handler, data, createSlide } = await PptxHandler.createBlank({ title: '3D' });
		const slide = createSlide('Blank').build();
		const glb = Buffer.from('glTF-test-bytes').toString('base64');
		const png =
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
		const model = {
			type: 'model3d',
			id: 'm1',
			name: 'Model',
			x: 10,
			y: 10,
			width: 200,
			height: 100,
			modelData: `data:model/gltf-binary;base64,${glb}`,
			posterImage: `data:image/png;base64,${png}`,
		} as PptxElement;
		slide.elements = [model];
		data.slides = [slide];
		const blobs = metroBlobs(await handler.save(data.slides, { outputFormat: 'ppt' }));
		expect(blobs).toHaveLength(1);
		const zip = await JSZip.loadAsync(blobs[0]!);
		const frame = await zip.file('drs/e2oDoc.xml')!.async('string');
		expect(frame).toContain('<am3d:model3d r:embed="rId1">');
		// objViewport is what PowerPoint needs to accept the package (COM-measured).
		expect(frame).toContain('<am3d:objViewport');
		await expect(zip.file('drs/media/model3d1.glb')!.async('string')).resolves.toBe(
			'glTF-test-bytes',
		);
		expect(zip.file('drs/media/image1.png')).not.toBeNull();
	}, 60_000);
});
