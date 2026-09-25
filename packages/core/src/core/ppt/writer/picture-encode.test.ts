/**
 * Unit tests for the `.ppt` writer's picture encoding (`picture-encode.ts`),
 * the GIF decoder it uses, and the async source pre-pass
 * (`picture-resolve.ts`).
 *
 * @module ppt/writer/picture-encode.test
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxSlide } from '../../types';
import { decodeGifFirstFrame } from '../../utils/gif-decode';
import { bytesToPicture, sniffImageFormat } from './picture-encode';
import { resolvePictureSources } from './picture-resolve';

const FIXTURE = path.resolve(__dirname, '../../../__tests__/fixtures/picture-formats.pptx');

/** A 2x2 24-bit bottom-up BMP: red, green / blue, white. */
function makeBmp(): Uint8Array {
	const rowBytes = 8; // 2 px * 3 bytes, padded to 4
	const out = new Uint8Array(54 + rowBytes * 2);
	const v = new DataView(out.buffer);
	out[0] = 0x42;
	out[1] = 0x4d;
	v.setUint32(2, out.length, true);
	v.setUint32(10, 54, true);
	v.setUint32(14, 40, true);
	v.setInt32(18, 2, true);
	v.setInt32(22, 2, true);
	v.setUint16(26, 1, true);
	v.setUint16(28, 24, true);
	// Bottom row first (BGR): blue, white; then top row: red, green.
	out.set([0xff, 0, 0, 0xff, 0xff, 0xff], 54);
	out.set([0, 0, 0xff, 0, 0xff, 0], 54 + rowBytes);
	return out;
}

async function fixtureParts(): Promise<JSZip> {
	return JSZip.loadAsync(readFileSync(FIXTURE));
}

async function part(zip: JSZip, ext: string): Promise<Uint8Array> {
	const name = Object.keys(zip.files).find((n) => n.startsWith('ppt/media/') && n.endsWith(ext))!;
	return zip.file(name)!.async('uint8array');
}

describe('sniffImageFormat', () => {
	it('identifies every PowerPoint-authored picture part by its bytes', async () => {
		const zip = await fixtureParts();
		const expected: Array<[string, string]> = [
			['.png', 'png'],
			['.gif', 'gif'],
			['.tif', 'tiff'],
			['.emf', 'emf'],
			['.wmf', 'wmf'],
			['.svg', 'svg'],
		];
		for (const [ext, format] of expected) {
			expect(sniffImageFormat(await part(zip, ext))).toBe(format);
		}
		expect(sniffImageFormat(makeBmp())).toBe('bmp');
	});
});

describe('bytesToPicture', () => {
	it('strips a BMP file header into a packed DIB', () => {
		const bmp = makeBmp();
		const picture = bytesToPicture(bmp)!;
		expect(picture.extension).toBe('dib');
		expect(Array.from(picture.bytes)).toStrictEqual(Array.from(bmp.subarray(14)));
	});

	it('re-encodes a GIF as a PNG of the same size', async () => {
		const gif = await part(await fixtureParts(), '.gif');
		const picture = bytesToPicture(gif)!;
		expect(picture.extension).toBe('png');
		expect(sniffImageFormat(picture.bytes)).toBe('png');
	});

	it('has no synchronous path for TIFF or SVG', async () => {
		const zip = await fixtureParts();
		expect(bytesToPicture(await part(zip, '.tif'))).toBeUndefined();
		expect(bytesToPicture(await part(zip, '.svg'))).toBeUndefined();
	});
});

describe('decodeGifFirstFrame', () => {
	it('decodes the PowerPoint-authored GIF (dodger-blue field, orange-red ellipse)', async () => {
		const frame = decodeGifFirstFrame(await part(await fixtureParts(), '.gif'))!;
		expect([frame.width, frame.height]).toStrictEqual([64, 48]);
		const px = (x: number, y: number): number[] =>
			Array.from(frame.rgba.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 4));
		const [r0, , b0, a0] = px(1, 1);
		expect(b0).toBeGreaterThan(r0!);
		expect(a0).toBe(255);
		const [r1, , b1] = px(28, 23);
		expect(r1).toBeGreaterThan(b1!);
	});
});

describe('resolvePictureSources', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('fetches a blob: imageData (what a browser load mints) when there is no part', async () => {
		const bmp = makeBmp();
		vi.stubGlobal('fetch', async () => new Response(bmp.slice()));
		const { data, createSlide } = await PptxHandler.create({ initialSlideCount: 0 });
		const slide = createSlide('Blank').addImage('data:image/png;base64,').build();
		Object.assign(slide.elements[0]!, {
			imageData: 'blob:http://localhost/abc',
			imagePath: undefined,
		});
		data.slides.push(slide);
		const resolved = await resolvePictureSources(data.slides as PptxSlide[], async () => undefined);
		expect([...resolved.values()].map((p) => p.extension)).toStrictEqual(['dib']);
	});

	it('prefers the zip part over a render-only conversion of a different format', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(new Uint8Array(readFileSync(FIXTURE)));
		const emfEl = data.slides[0]!.elements.find((e) => e.name === 'pic-img.emf')!;
		(emfEl as { imageData?: string }).imageData = 'data:image/png;base64,iVBORw0KGgo=';
		const zip = await fixtureParts();
		const resolved = await resolvePictureSources(data.slides, async (p) =>
			zip.file(p)?.async('uint8array'),
		);
		expect(resolved.get(emfEl)?.extension).toBe('emf');
	});
});
