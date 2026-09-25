/**
 * `.ppt` export of every picture format, measured against PowerPoint 16.0's
 * own 97-2003 SaveAs of the same PowerPoint-authored deck
 * (`__tests__/fixtures/picture-formats.pptx`, authored by
 * `scripts/make-picture-formats-fixture.ps1`: a BMP, GIF, TIFF, EMF, WMF and
 * SVG, each inserted with `Shapes.AddPicture`).
 *
 * PowerPoint's own `Pictures` stream for that deck (COM-measured) holds, in
 * shape order: PNG (the BMP, converted to PNG on insert), PNG (GIF), PNG
 * (TIFF), EMF, WMF, PNG (the SVG, rasterised). The constants below are
 * copied from it.
 *
 * @module ppt/writer/ppt-writer-picture-formats.test
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import { zlibInflate } from '../../utils/inflate';
import { parseOle2 } from '../../utils/ole2-parser-read';
import { OA } from '../record-types';

const FIXTURE = path.resolve(__dirname, '../../../__tests__/fixtures/picture-formats.pptx');

interface Blip {
	recType: number;
	recInstance: number;
	data: Uint8Array;
}

function readBlips(ppt: Uint8Array): Blip[] {
	const ole = parseOle2(ppt.slice().buffer as ArrayBuffer);
	const stream = ole.getStream('Pictures');
	if (!stream) {
		return [];
	}
	const view = new DataView(stream.buffer, stream.byteOffset, stream.byteLength);
	const blips: Blip[] = [];
	for (let pos = 0; pos + 8 <= stream.length;) {
		const len = view.getUint32(pos + 4, true);
		blips.push({
			recType: view.getUint16(pos + 2, true),
			recInstance: view.getUint16(pos, true) >> 4,
			data: stream.subarray(pos + 8, pos + 8 + len),
		});
		pos += 8 + len;
	}
	return blips;
}

const hex = (bytes: Uint8Array): string =>
	Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Metafile header (after rgbUid): cbSize, rcBounds, ptSize, cbSave, compression, filter. */
function metafileHeader(blip: Blip): number[] {
	const v = new DataView(blip.data.buffer, blip.data.byteOffset + 16, 34);
	return [
		v.getUint32(0, true),
		v.getInt32(4, true),
		v.getInt32(8, true),
		v.getInt32(12, true),
		v.getInt32(16, true),
		v.getInt32(20, true),
		v.getInt32(24, true),
		v.getUint8(32),
		v.getUint8(33),
	];
}

describe('.ppt export of picture formats (vs PowerPoint 97-2003 SaveAs)', () => {
	async function exportFixture(): Promise<{ blips: Blip[]; warnings: string[] }> {
		const handler = new PptxHandler();
		const data = await handler.load(new Uint8Array(readFileSync(FIXTURE)));
		const ppt = await handler.save(data.slides, { outputFormat: 'ppt' });
		const warnings = handler.getCompatibilityWarnings().map((w) => w.code);
		return { blips: readBlips(ppt), warnings };
	}

	it('embeds every raster and metafile picture a loaded deck carries only by part path', async () => {
		const { blips, warnings } = await exportFixture();
		// Node has no SVG rasteriser, so only the fallback-less SVG degrades.
		expect(blips.map((b) => b.recType)).toStrictEqual([
			OA.BlipPng,
			OA.BlipPng,
			OA.BlipPng,
			OA.BlipEmf,
			OA.BlipWmf,
		]);
		expect(warnings.filter((code) => code === 'ppt-image-format-unsupported')).toHaveLength(1);
	});

	it('writes the same rgbUid (MD4 of the picture data) PowerPoint writes', async () => {
		const { blips } = await exportFixture();
		expect(hex(blips[0]!.data.subarray(0, 16))).toBe('ed2f20a9b67618d9b89db017462e9332');
		expect(hex(blips[3]!.data.subarray(0, 16))).toBe('bfccb44c0d6eeb978b0af84ea988c419');
	});

	it('writes the EMF natively with the bounds and compression flags PowerPoint writes', async () => {
		const { blips } = await exportFixture();
		const emf = blips[3]!;
		expect(emf.recInstance).toBe(0x3d4);
		const [cbSize, l, t, r, b, , , compression, filter] = metafileHeader(emf);
		// PowerPoint: cbSize 628, rcBounds (0,0,200,100), compression 0, filter 0xFE.
		expect([cbSize, l, t, r, b, compression, filter]).toStrictEqual([628, 0, 0, 200, 100, 0, 0xfe]);
		const inflated = zlibInflate(emf.data.subarray(16 + 34));
		expect(inflated).toHaveLength(628);
		expect(String.fromCharCode(...inflated.subarray(40, 44))).toBe(' EMF');
	});

	it('writes the WMF with its placeable header moved into the metafile header, as PowerPoint does', async () => {
		const { blips } = await exportFixture();
		const wmf = blips[4]!;
		expect(wmf.recInstance).toBe(0x216);
		// PowerPoint: cbSize 116 (138 - 22-byte placeable header), rcBounds
		// (0,0,200,100), ptSize 1905000 x 952500 EMU (200 x 100 at 96 units/inch).
		expect(metafileHeader(wmf)).toStrictEqual([116, 0, 0, 200, 100, 1905000, 952500, 0, 0xfe]);
		const inflated = zlibInflate(wmf.data.subarray(16 + 34));
		expect(Array.from(inflated.subarray(0, 4))).toStrictEqual([1, 0, 9, 0]); // META_HEADER, no placeable key
	});

	it('reimports the EMF and WMF byte-identical to the source parts', async () => {
		const source = await JSZip.loadAsync(readFileSync(FIXTURE));
		const handler = new PptxHandler();
		const data = await handler.load(new Uint8Array(readFileSync(FIXTURE)));
		const ppt = await handler.save(data.slides, { outputFormat: 'ppt' });
		const reloaded = new PptxHandler();
		const back = await reloaded.load(ppt.slice().buffer as ArrayBuffer);
		const resaved = await JSZip.loadAsync(await reloaded.save(back.slides));
		const media = async (zip: JSZip, ext: string): Promise<Uint8Array | undefined> => {
			const name = Object.keys(zip.files).find(
				(n) => n.startsWith('ppt/media/') && n.endsWith(ext),
			);
			return name ? zip.file(name)!.async('uint8array') : undefined;
		};
		for (const ext of ['.emf', '.wmf']) {
			expect(hex((await media(resaved, ext))!)).toBe(hex((await media(source, ext))!));
		}
	});

	it('re-encodes the GIF and TIFF as PNG, as PowerPoint does', async () => {
		const { blips } = await exportFixture();
		for (const blip of [blips[1]!, blips[2]!]) {
			const png = blip.data.subarray(17);
			expect(Array.from(png.subarray(1, 4))).toStrictEqual([0x50, 0x4e, 0x47]);
			const view = new DataView(png.buffer, png.byteOffset + 16, 8);
			expect([view.getUint32(0), view.getUint32(4)]).toStrictEqual([64, 48]);
		}
	});
});
