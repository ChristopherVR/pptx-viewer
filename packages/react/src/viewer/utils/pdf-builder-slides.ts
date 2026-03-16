/**
 * Slides-only PDF builder.
 *
 * Generates a landscape PDF with one slide image per page.
 * Also provides canvas-to-JPEG conversion utilities for
 * memory-efficient PDF generation.
 *
 * @module pdf-builder-slides
 */

import type { PdfImageData } from './pdf-builder-types';

/* ------------------------------------------------------------------ */
/*  Canvas -> JPEG conversion helper                                   */
/* ------------------------------------------------------------------ */

/**
 * Convert an HTMLCanvasElement to JPEG bytes suitable for PDF embedding.
 *
 * Call this immediately after rendering each slide, then discard the
 * canvas to free the large pixel buffer (~33 MB at 2x 1920x1080).
 * The resulting JPEG is typically 200-500 KB.
 *
 * @param canvas - The rendered slide canvas.
 * @param quality - JPEG quality (0 to 1). Defaults to 0.92.
 * @returns Pre-converted image data for PDF embedding.
 */
export function canvasToJpegData(canvas: HTMLCanvasElement, quality: number = 0.92): PdfImageData {
	const dataUrl = canvas.toDataURL('image/jpeg', quality);
	const base64 = dataUrl.split(',')[1] ?? '';
	const raw = atob(base64);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) {
		bytes[i] = raw.charCodeAt(i);
	}
	return { bytes, w: canvas.width, h: canvas.height };
}

/* ------------------------------------------------------------------ */
/*  Slides-only PDF builder                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a PDF from pre-converted JPEG image data.
 *
 * This is the memory-efficient entry point: callers convert each canvas
 * to JPEG bytes immediately after rendering (via {@link canvasToJpegData}),
 * discard the canvas, and pass only the compact JPEG data here.
 *
 * Each image becomes a full page in landscape A4 (842 x 595 pt).
 *
 * @param images - Array of pre-converted JPEG image data.
 * @returns Object URL pointing to the generated PDF blob.
 */
export function buildPdfFromImageData(images: PdfImageData[]): string {
	const PAGE_W = 842; // A4 landscape width in pt
	const PAGE_H = 595; // A4 landscape height in pt

	// --- Build a minimal valid PDF 1.4 byte-stream ---
	const parts: string[] = [];
	const offsets: number[] = [];
	let pos = 0;

	const emit = (s: string) => {
		parts.push(s);
		pos += s.length;
	};

	emit('%PDF-1.4\n');

	// We create objects in order:
	// 1 = Catalog, 2 = Pages, then per image: (imageObj, pageObj, contentsObj), Resources aggregated per-page inline
	const objCount = 2 + images.length * 3; // catalog + pages + 3 per image
	const pageObjIds: number[] = [];

	// --- Object 1: Catalog ---
	offsets.push(pos);
	emit('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

	// -- Reset and use a different approach --
	parts.length = 0;
	offsets.length = 0;
	pos = 0;

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

	// Obj 1: Catalog
	markObj();
	emitStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

	// Reserve obj 2 for Pages -- write last before xref
	// Write per-page objects (3 per page)
	for (let i = 0; i < images.length; i++) {
		const img = images[i];
		const imgObjId = 3 + i * 3;
		const pageObjId = 3 + i * 3 + 1;
		const contObjId = 3 + i * 3 + 2;
		pageObjIds.push(pageObjId);

		// Fit image to page
		const scale = Math.min(PAGE_W / img.w, PAGE_H / img.h);
		const dw = img.w * scale;
		const dh = img.h * scale;
		const dx = (PAGE_W - dw) / 2;
		const dy = (PAGE_H - dh) / 2;

		// Image XObject
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

		// Page object
		markObj();
		emitStr(
			`${pageObjId} 0 obj\n` +
				`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}]` +
				` /Contents ${contObjId} 0 R` +
				` /Resources << /XObject << /Img${i} ${imgObjId} 0 R >> >> >>\n` +
				`endobj\n`,
		);

		// Contents stream -- draw image
		const contentStream = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Img${i} Do Q`;
		markObj();
		emitStr(
			`${contObjId} 0 obj\n` +
				`<< /Length ${contentStream.length} >>\n` +
				`stream\n${contentStream}\nendstream\nendobj\n`,
		);
	}

	// Obj 2: Pages
	const pagesKids = pageObjIds.map((id) => `${id} 0 R`).join(' ');
	offsets.splice(1, 0, pos); // insert at index 1 since obj 2 is written now
	emitStr(`2 0 obj\n<< /Type /Pages /Kids [${pagesKids}] /Count ${images.length} >>\nendobj\n`);

	// Cross-reference table
	const xrefPos = pos;
	const totalObjs = objCount + 1; // +1 for free entry
	emitStr(`xref\n0 ${totalObjs}\n`);
	emitStr('0000000000 65535 f \n');

	// Sort offsets by object number
	for (let i = 0; i < objCount; i++) {
		const off = offsets[i] ?? 0;
		emitStr(`${String(off).padStart(10, '0')} 00000 n \n`);
	}

	emitStr(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

	// Merge segments into a single Uint8Array
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
	const result = new Uint8Array(totalLen);
	let offset = 0;
	for (const chunk of encoded) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	const blob = new Blob([result], { type: 'application/pdf' });
	return URL.createObjectURL(blob);
}

/**
 * Legacy wrapper: converts canvases to JPEG then builds PDF.
 *
 * Prefer {@link buildPdfFromImageData} with {@link canvasToJpegData} for
 * large presentations -- it lets you discard each canvas after conversion
 * instead of holding all canvases in memory simultaneously.
 *
 * @param canvases - Array of rendered slide canvases.
 * @returns Object URL pointing to the generated PDF blob.
 */
export function buildPdfFromCanvases(canvases: HTMLCanvasElement[]): string {
	const images = canvases.map((c) => canvasToJpegData(c));
	return buildPdfFromImageData(images);
}
