/**
 * Pure slides-only PDF byte assembly, shared by every binding's PDF export.
 *
 * Given pre-converted JPEG image data (one per slide), build a minimal valid
 * PDF 1.4 byte stream with one slide image per landscape A4 page. No DOM
 * dependency: the binding owns canvas->JPEG conversion and the final
 * `Blob`/object-URL.
 */

import type { PdfImageData } from './pdf-notes-layout';

/**
 * Landscape A4 page size, in points, that every page `buildSlidesPdfBytes`/
 * `buildTiledSlidesPdfBytes` writes uses. Exported so a caller computing tile
 * placements (`placeTileOnPage` in `pdf-tile-placement.ts`) passes the exact
 * same page size the PDF bytes are actually built with, rather than
 * re-deriving a slightly different rounding (`pdf-page-size.ts`'s
 * `A4_PT_W`/`A4_PT_H` are unrelated: that module sizes a *fitted, orientation-
 * aware* page for the vue/svelte/vanilla/angular jsPDF path, which this
 * fixed-landscape hand-rolled encoder does not use).
 */
export const PDF_SLIDES_PAGE_WIDTH_PT = 842;
export const PDF_SLIDES_PAGE_HEIGHT_PT = 595;

/**
 * Build a PDF byte stream from pre-converted JPEG image data.
 *
 * Each image becomes a full page in landscape A4 (842 x 595 pt).
 *
 * @param images - Array of pre-converted JPEG image data.
 * @returns The assembled PDF as a single `Uint8Array`.
 */
export function buildSlidesPdfBytes(images: PdfImageData[]): Uint8Array<ArrayBuffer> {
	const PAGE_W = PDF_SLIDES_PAGE_WIDTH_PT;
	const PAGE_H = PDF_SLIDES_PAGE_HEIGHT_PT;

	const offsets: number[] = [];
	let pos = 0;

	const objCount = 2 + images.length * 3;
	const pageObjIds: number[] = [];

	const segments: (string | Uint8Array)[] = [];
	const emitStr = (s: string) => {
		segments.push(s);
		pos += s.length;
	};
	const emitBin = (b: Uint8Array) => {
		segments.push(b);
		pos += b.length;
	};
	const markObj = () => {
		offsets.push(pos);
	};

	emitStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

	markObj();
	emitStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

	for (let i = 0; i < images.length; i++) {
		const img = images[i];
		const imgObjId = 3 + i * 3;
		const pageObjId = 3 + i * 3 + 1;
		const contObjId = 3 + i * 3 + 2;
		pageObjIds.push(pageObjId);

		const scale = Math.min(PAGE_W / img.w, PAGE_H / img.h);
		const dw = img.w * scale;
		const dh = img.h * scale;
		const dx = (PAGE_W - dw) / 2;
		const dy = (PAGE_H - dh) / 2;

		markObj();
		const imgHeader =
			`${imgObjId} 0 obj\n` +
			`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h}` +
			` /ColorSpace /DeviceRGB /BitsPerComponent 8` +
			` /Filter /DCTDecode /Length ${img.bytes.length} >>\n` +
			`stream\n`;
		emitStr(imgHeader);
		emitBin(img.bytes);
		emitStr('\nendstream\nendobj\n');

		markObj();
		emitStr(
			`${pageObjId} 0 obj\n` +
				`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}]` +
				` /Contents ${contObjId} 0 R` +
				` /Resources << /XObject << /Img${i} ${imgObjId} 0 R >> >> >>\n` +
				`endobj\n`,
		);

		const contentStream = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Img${i} Do Q`;
		markObj();
		emitStr(
			`${contObjId} 0 obj\n` +
				`<< /Length ${contentStream.length} >>\n` +
				`stream\n${contentStream}\nendstream\nendobj\n`,
		);
	}

	const pagesKids = pageObjIds.map((id) => `${id} 0 R`).join(' ');
	offsets.splice(1, 0, pos);
	emitStr(`2 0 obj\n<< /Type /Pages /Kids [${pagesKids}] /Count ${images.length} >>\nendobj\n`);

	const xrefPos = pos;
	const totalObjs = objCount + 1;
	emitStr(`xref\n0 ${totalObjs}\n`);
	emitStr('0000000000 65535 f \n');

	for (let i = 0; i < objCount; i++) {
		const off = offsets[i] ?? 0;
		emitStr(`${String(off).padStart(10, '0')} 00000 n \n`);
	}

	emitStr(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

	return mergeSegments(segments);
}

/** One tile image and where it lands on its PDF page (see `pdf-tile-placement.ts`). */
export interface PdfTiledPageImage {
	image: PdfImageData;
	/** Top-down PDF-page-point placement (y grows downward from the page's top edge). */
	placement: { x: number; y: number; width: number; height: number };
}

/**
 * Build a PDF byte stream where each page may be composed of several tile
 * images (`placeTileOnPage` in `pdf-tile-placement.ts` computes each tile's
 * placement) instead of exactly one full-page image. This is what lets a PDF
 * export escape the browser canvas cap: every tile is individually small
 * (each came from a capped-size canvas), but a PDF page has no canvas-size
 * limit of its own to bump into.
 *
 * A single-tile page (the overwhelming majority - most exports never need
 * tiling) degrades to exactly the same page {@link buildSlidesPdfBytes}
 * would produce.
 *
 * @param pages - One entry per page; each entry is that page's tile images
 *   and their placements, in any order (the content stream draws them in
 *   list order, which does not matter since tiles never overlap).
 */
export function buildTiledSlidesPdfBytes(pages: PdfTiledPageImage[][]): Uint8Array<ArrayBuffer> {
	const PAGE_W = PDF_SLIDES_PAGE_WIDTH_PT;
	const PAGE_H = PDF_SLIDES_PAGE_HEIGHT_PT;

	const offsets: number[] = [];
	let pos = 0;
	const segments: (string | Uint8Array)[] = [];
	const emitStr = (s: string) => {
		segments.push(s);
		pos += s.length;
	};
	const emitBin = (b: Uint8Array) => {
		segments.push(b);
		pos += b.length;
	};
	const markObj = () => {
		offsets.push(pos);
	};

	emitStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

	markObj();
	emitStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

	let nextObjId = 3;
	const pageObjIds: number[] = [];

	for (const pageImages of pages) {
		const imgObjIds: number[] = [];
		for (let i = 0; i < pageImages.length; i++) {
			imgObjIds.push(nextObjId);
			nextObjId++;
		}
		const pageObjId = nextObjId++;
		const contObjId = nextObjId++;
		pageObjIds.push(pageObjId);

		for (let idx = 0; idx < pageImages.length; idx++) {
			markObj();
			const { image } = pageImages[idx];
			emitStr(
				`${imgObjIds[idx]} 0 obj\n` +
					`<< /Type /XObject /Subtype /Image /Width ${image.w} /Height ${image.h}` +
					` /ColorSpace /DeviceRGB /BitsPerComponent 8` +
					` /Filter /DCTDecode /Length ${image.bytes.length} >>\n` +
					`stream\n`,
			);
			emitBin(image.bytes);
			emitStr('\nendstream\nendobj\n');
		}

		markObj();
		const xobjectDict = pageImages.map((_, idx) => `/Img${idx} ${imgObjIds[idx]} 0 R`).join(' ');
		emitStr(
			`${pageObjId} 0 obj\n` +
				`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}]` +
				` /Contents ${contObjId} 0 R /Resources << /XObject << ${xobjectDict} >> >> >>\n` +
				`endobj\n`,
		);

		// PDF content-stream space is bottom-up; `placement.y` is top-down (see
		// `pdf-tile-placement.ts`), so flip it here, once, at the point of emission.
		const contentStream = pageImages
			.map((entry, idx) => {
				const { x, y, width, height } = entry.placement;
				const rawY = PAGE_H - y - height;
				return `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${rawY.toFixed(2)} cm /Img${idx} Do Q`;
			})
			.join(' ');
		markObj();
		emitStr(
			`${contObjId} 0 obj\n` +
				`<< /Length ${contentStream.length} >>\n` +
				`stream\n${contentStream}\nendstream\nendobj\n`,
		);
	}

	const pagesKids = pageObjIds.map((id) => `${id} 0 R`).join(' ');
	offsets.splice(1, 0, pos);
	emitStr(`2 0 obj\n<< /Type /Pages /Kids [${pagesKids}] /Count ${pages.length} >>\nendobj\n`);

	const objCount = nextObjId - 1;
	const xrefPos = pos;
	const totalObjs = objCount + 1;
	emitStr(`xref\n0 ${totalObjs}\n`);
	emitStr('0000000000 65535 f \n');

	for (let i = 0; i < objCount; i++) {
		const off = offsets[i] ?? 0;
		emitStr(`${String(off).padStart(10, '0')} 00000 n \n`);
	}

	emitStr(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

	return mergeSegments(segments);
}

/** Merge a list of string/binary segments into a single `Uint8Array`. */
export function mergeSegments(segments: (string | Uint8Array)[]): Uint8Array<ArrayBuffer> {
	const encoder = new TextEncoder();
	let totalLen = 0;
	const encoded = segments.map((s) => {
		if (typeof s === 'string') {
			const b = encoder.encode(s);
			totalLen += b.length;
			return b;
		}
		totalLen += s.length;
		return s;
	});
	const result = new Uint8Array(new ArrayBuffer(totalLen));
	let offset = 0;
	for (const chunk of encoded) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}
