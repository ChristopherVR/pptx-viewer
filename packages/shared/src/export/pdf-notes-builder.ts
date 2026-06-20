/**
 * Pure notes-page PDF byte assembly, shared by every binding's PDF export.
 *
 * Each page contains the slide image in the upper 2/3 and speaker notes text in
 * the lower 1/3, following PowerPoint's "Notes Pages" print layout. If notes
 * overflow the primary page, continuation pages are emitted with a
 * "Slide N (continued)" header.
 *
 * No DOM dependency: the binding converts canvases to JPEG bytes up front and
 * passes the compact image data plus per-slide notes here.
 */

import {
	buildNotesTextStream,
	calculateContinuationPageMaxLines,
	calculateNotesPageLayout,
	escapePdfText,
	NOTES_BORDER_WIDTH,
	NOTES_CONTINUATION_HEADER_SIZE,
	NOTES_FONT_SIZE,
	NOTES_GAP,
	NOTES_MARGIN,
	NOTES_PAGE_H,
	NOTES_PAGE_W,
	wrapNotesText,
} from './pdf-notes-layout';
import type { PdfImageData } from './pdf-notes-layout';
import { mergeSegments } from './pdf-slides';

/** Per-slide notes metadata paired by index with the slide image data. */
export interface NotesPageMeta {
	/** Plain-text speaker notes for this slide (may be empty/undefined). */
	notes?: string;
	/** One-based slide number for the header. */
	slideNumber: number;
}

interface PdfPageDescriptor {
	kind: 'primary' | 'continuation';
	imageIndex?: number;
	slideNumber: number;
	lines: string[];
	notesStartY: number;
	layout?: ReturnType<typeof calculateNotesPageLayout>;
}

/**
 * Build a notes-page PDF byte stream from pre-converted slide JPEG data and the
 * matching per-slide notes metadata.
 *
 * @param images - JPEG image data, one entry per slide (index-aligned to `meta`).
 * @param meta   - Notes + slide-number for each slide (index-aligned to `images`).
 * @returns The assembled PDF as a single `Uint8Array`.
 */
export function buildNotesPdfBytes(
	images: PdfImageData[],
	meta: NotesPageMeta[],
): Uint8Array<ArrayBuffer> {
	const pdfPages: PdfPageDescriptor[] = [];
	const continuationMaxLines = calculateContinuationPageMaxLines();
	const continuationTextStartY =
		NOTES_PAGE_H - NOTES_MARGIN - NOTES_CONTINUATION_HEADER_SIZE - NOTES_GAP;

	for (let i = 0; i < images.length; i++) {
		const img = images[i];
		const slideMeta = meta[i];
		const layout = calculateNotesPageLayout(img.w, img.h);

		const contentWidth = NOTES_PAGE_W - 2 * NOTES_MARGIN;
		const wrappedLines =
			slideMeta.notes && slideMeta.notes.trim().length > 0
				? wrapNotesText(slideMeta.notes, contentWidth, NOTES_FONT_SIZE)
				: [];

		const primaryLines = wrappedLines.slice(0, layout.maxNotesLines);
		pdfPages.push({
			kind: 'primary',
			imageIndex: i,
			slideNumber: slideMeta.slideNumber,
			lines: primaryLines,
			notesStartY: layout.notesTextY,
			layout,
		});

		let remaining = wrappedLines.slice(layout.maxNotesLines);
		while (remaining.length > 0) {
			const chunk = remaining.slice(0, continuationMaxLines);
			remaining = remaining.slice(continuationMaxLines);
			pdfPages.push({
				kind: 'continuation',
				slideNumber: slideMeta.slideNumber,
				lines: chunk,
				notesStartY: continuationTextStartY,
			});
		}
	}

	let nextObjId = 3;
	const pageEmitPlan: {
		descriptor: PdfPageDescriptor;
		imgObjId?: number;
		pageObjId: number;
		contObjId: number;
	}[] = [];

	for (const desc of pdfPages) {
		if (desc.kind === 'primary') {
			const imgObjId = nextObjId++;
			const pageObjId = nextObjId++;
			const contObjId = nextObjId++;
			pageEmitPlan.push({ descriptor: desc, imgObjId, pageObjId, contObjId });
		} else {
			const pageObjId = nextObjId++;
			const contObjId = nextObjId++;
			pageEmitPlan.push({ descriptor: desc, pageObjId, contObjId });
		}
	}

	const fontObjId = nextObjId++;
	const objCount = fontObjId;
	const pageObjIds: number[] = pageEmitPlan.map((p) => p.pageObjId);

	const segments: (string | Uint8Array)[] = [];
	const offsets: number[] = Array.from({ length: objCount }, () => 0);
	let pos = 0;

	const emitStr = (s: string) => {
		segments.push(s);
		pos += s.length;
	};
	const emitBin = (b: Uint8Array) => {
		segments.push(b);
		pos += b.length;
	};
	const markObj = (objId: number) => {
		offsets[objId - 1] = pos;
	};

	emitStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

	markObj(1);
	emitStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

	for (const plan of pageEmitPlan) {
		const desc = plan.descriptor;

		if (desc.kind === 'primary' && plan.imgObjId !== undefined && plan.imgObjId !== null) {
			const img = images[desc.imageIndex!];
			const layout = desc.layout!;

			markObj(plan.imgObjId);
			const imgHeader =
				`${plan.imgObjId} 0 obj\n` +
				`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h}` +
				` /ColorSpace /DeviceRGB /BitsPerComponent 8` +
				` /Filter /DCTDecode /Length ${img.bytes.length} >>\n` +
				`stream\n`;
			emitStr(imgHeader);
			emitBin(img.bytes);
			emitStr('\nendstream\nendobj\n');

			let content = '';

			content +=
				`q ${layout.imageWidth.toFixed(2)} 0 0 ${layout.imageHeight.toFixed(2)} ` +
				`${layout.imageX.toFixed(2)} ${layout.imageY.toFixed(2)} cm /Img Do Q\n`;

			content +=
				`q ${NOTES_BORDER_WIDTH} w 0.6 0.6 0.6 RG ` +
				`${layout.imageX.toFixed(2)} ${layout.imageY.toFixed(2)} ` +
				`${layout.imageWidth.toFixed(2)} ${layout.imageHeight.toFixed(2)} re S Q\n`;

			const separatorY = layout.imageY - NOTES_GAP / 2;
			content +=
				`q 0.5 w 0.75 0.75 0.75 RG ` +
				`${NOTES_MARGIN} ${separatorY.toFixed(2)} m ` +
				`${(NOTES_PAGE_W - NOTES_MARGIN).toFixed(2)} ${separatorY.toFixed(2)} l S Q\n`;

			content +=
				`BT /F1 9 Tf 0.4 0.4 0.4 rg ` +
				`${NOTES_MARGIN} ${(NOTES_PAGE_H - NOTES_MARGIN + 8).toFixed(2)} Td ` +
				`(${escapePdfText(`Slide ${desc.slideNumber}`)}) Tj ET\n`;

			content += buildNotesTextStream(desc.lines, desc.notesStartY);

			markObj(plan.pageObjId);
			emitStr(
				`${plan.pageObjId} 0 obj\n` +
					`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${NOTES_PAGE_W} ${NOTES_PAGE_H}]` +
					` /Contents ${plan.contObjId} 0 R` +
					` /Resources << /XObject << /Img ${plan.imgObjId} 0 R >>` +
					` /Font << /F1 ${fontObjId} 0 R >> >> >>\n` +
					`endobj\n`,
			);

			markObj(plan.contObjId);
			emitStr(
				`${plan.contObjId} 0 obj\n` +
					`<< /Length ${content.length} >>\n` +
					`stream\n${content}\nendstream\nendobj\n`,
			);
		} else {
			let content = '';

			content +=
				`BT /F1 ${NOTES_CONTINUATION_HEADER_SIZE} Tf 0.4 0.4 0.4 rg ` +
				`${NOTES_MARGIN} ${(NOTES_PAGE_H - NOTES_MARGIN + 8).toFixed(2)} Td ` +
				`(${escapePdfText(`Slide ${desc.slideNumber} (continued)`)}) Tj ET\n`;

			content += buildNotesTextStream(desc.lines, desc.notesStartY);

			markObj(plan.pageObjId);
			emitStr(
				`${plan.pageObjId} 0 obj\n` +
					`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${NOTES_PAGE_W} ${NOTES_PAGE_H}]` +
					` /Contents ${plan.contObjId} 0 R` +
					` /Resources << /Font << /F1 ${fontObjId} 0 R >> >> >>\n` +
					`endobj\n`,
			);

			markObj(plan.contObjId);
			emitStr(
				`${plan.contObjId} 0 obj\n` +
					`<< /Length ${content.length} >>\n` +
					`stream\n${content}\nendstream\nendobj\n`,
			);
		}
	}

	markObj(fontObjId);
	emitStr(
		`${fontObjId} 0 obj\n` +
			`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n` +
			`endobj\n`,
	);

	const pagesKids = pageObjIds.map((id) => `${id} 0 R`).join(' ');
	markObj(2);
	emitStr(`2 0 obj\n<< /Type /Pages /Kids [${pagesKids}] /Count ${pdfPages.length} >>\nendobj\n`);

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
