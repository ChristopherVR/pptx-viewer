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
 * Build a PDF byte stream from pre-converted JPEG image data.
 *
 * Each image becomes a full page in landscape A4 (842 x 595 pt).
 *
 * @param images - Array of pre-converted JPEG image data.
 * @returns The assembled PDF as a single `Uint8Array`.
 */
export function buildSlidesPdfBytes(images: PdfImageData[]): Uint8Array<ArrayBuffer> {
	const PAGE_W = 842;
	const PAGE_H = 595;

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
