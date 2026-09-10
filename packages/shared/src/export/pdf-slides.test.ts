import { describe, expect, it } from 'vitest';

import type { PdfImageData } from './pdf-notes-layout';
import { buildSlidesPdfBytes, buildTiledSlidesPdfBytes, mergeSegments } from './pdf-slides';

function fakeJpeg(w: number, h: number, tag: number): PdfImageData {
	return { bytes: new Uint8Array([0xff, 0xd8, tag, 0xff, 0xd9]), w, h };
}

function text(bytes: Uint8Array): string {
	return new TextDecoder('latin1').decode(bytes);
}

describe('mergeSegments', () => {
	it('concatenates string and binary segments in order', () => {
		const merged = mergeSegments(['ab', new Uint8Array([1, 2]), 'cd']);
		expect(Array.from(merged)).toStrictEqual([97, 98, 1, 2, 99, 100]);
	});
});

describe('buildSlidesPdfBytes', () => {
	it('produces a valid single-page PDF for one image', () => {
		const bytes = buildSlidesPdfBytes([fakeJpeg(100, 50, 1)]);
		const str = text(bytes);
		expect(str.startsWith('%PDF-1.4')).toBeTruthy();
		expect(str).toContain('/Type /Catalog');
		expect(str).toContain('/Count 1');
		expect(str.trimEnd().endsWith('%%EOF')).toBeTruthy();
	});
});

describe('buildTiledSlidesPdfBytes', () => {
	it('degrades to a single-page, single-image PDF for a one-tile page', () => {
		const pages = [
			[{ image: fakeJpeg(100, 50, 7), placement: { x: 0, y: 0, width: 842, height: 421 } }],
		];
		const bytes = buildTiledSlidesPdfBytes(pages);
		const str = text(bytes);
		expect(str).toContain('/Count 1');
		expect(str).toContain('/XObject << /Img0');
		// Exactly one `Do` paint operator on the one page.
		expect(str.match(/\/Img0 Do/gu) ?? []).toHaveLength(1);
	});

	it('draws multiple tiles on one page with distinct XObject entries', () => {
		const pages = [
			[
				{ image: fakeJpeg(400, 300, 1), placement: { x: 0, y: 0, width: 421, height: 297.5 } },
				{
					image: fakeJpeg(400, 300, 2),
					placement: { x: 421, y: 0, width: 421, height: 297.5 },
				},
			],
		];
		const bytes = buildTiledSlidesPdfBytes(pages);
		const str = text(bytes);
		expect(str).toContain('/Img0');
		expect(str).toContain('/Img1');
		expect(str.match(/\/Img\d+ Do/gu) ?? []).toHaveLength(2);
		expect(str).toContain('/Count 1');
	});

	it('flips a top-down placement into PDF bottom-up content-stream coordinates', () => {
		const PAGE_H = 595;
		// Top-left tile placed at (0,0), 100x50 tall: PDF's native bottom-up
		// `cm` dy is the position of the image's BOTTOM edge, so it must equal
		// PAGE_H - y - height = 595 - 0 - 50 = 545.
		const pages = [
			[{ image: fakeJpeg(10, 5, 3), placement: { x: 0, y: 0, width: 100, height: 50 } }],
		];
		const str = text(buildTiledSlidesPdfBytes(pages));
		const match = /q [\d.]+ 0 0 [\d.]+ ([\d.]+) ([\d.]+) cm/u.exec(str);
		expect(match).not.toBeNull();
		expect(Number(match?.[2])).toBeCloseTo(PAGE_H - 50, 2);
	});

	it('produces one page per array entry, each with its own tile count', () => {
		const pages = [
			[{ image: fakeJpeg(10, 10, 1), placement: { x: 0, y: 0, width: 842, height: 595 } }],
			[
				{ image: fakeJpeg(10, 10, 2), placement: { x: 0, y: 0, width: 421, height: 595 } },
				{ image: fakeJpeg(10, 10, 3), placement: { x: 421, y: 0, width: 421, height: 595 } },
			],
		];
		const str = text(buildTiledSlidesPdfBytes(pages));
		expect(str).toContain('/Count 2');
		expect(str.match(/\/Type \/Page(?!s)/gu) ?? []).toHaveLength(2);
	});

	it('produces well-formed xref/trailer sections regardless of variable per-page object counts', () => {
		const pages = [
			[{ image: fakeJpeg(10, 10, 1), placement: { x: 0, y: 0, width: 842, height: 595 } }],
			[
				{ image: fakeJpeg(10, 10, 2), placement: { x: 0, y: 0, width: 421, height: 595 } },
				{ image: fakeJpeg(10, 10, 3), placement: { x: 421, y: 0, width: 421, height: 595 } },
				{ image: fakeJpeg(10, 10, 4), placement: { x: 0, y: 297.5, width: 421, height: 297.5 } },
			],
		];
		const bytes = buildTiledSlidesPdfBytes(pages);
		const str = text(bytes);
		const xrefMatch = /xref\nend?(\d+) (\d+)\n/u.exec(str) ?? /xref\n0 (\d+)\n/u.exec(str);
		expect(xrefMatch).not.toBeNull();
		expect(str).toContain('trailer');
		expect(str.trimEnd().endsWith('%%EOF')).toBeTruthy();
	});
});
