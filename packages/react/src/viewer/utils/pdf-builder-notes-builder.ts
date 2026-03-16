/**
 * Notes-page PDF document builder.
 *
 * Assembles the full PDF byte stream for the notes-page layout,
 * combining slide images with wrapped speaker notes text. Handles
 * page planning, object ID assignment, and PDF cross-reference
 * table generation.
 *
 * @module pdf-builder-notes-builder
 */

import {
	calculateNotesPageLayout,
	wrapNotesText,
	calculateContinuationPageMaxLines,
	escapePdfText,
	buildNotesTextStream,
} from './pdf-builder-notes-layout';
import type { NotesPageInput } from './pdf-builder-types';
import {
	NOTES_PAGE_W,
	NOTES_PAGE_H,
	NOTES_MARGIN,
	NOTES_FONT_SIZE,
	NOTES_GAP,
	NOTES_BORDER_WIDTH,
	NOTES_CONTINUATION_HEADER_SIZE,
} from './pdf-builder-types';

/* ------------------------------------------------------------------ */
/*  Internal page descriptor                                           */
/* ------------------------------------------------------------------ */

/**
 * Internal descriptor for a PDF page to be emitted.
 *
 * - Primary pages carry a slide image + (partial) notes.
 * - Continuation pages carry only overflow notes text.
 */
interface PdfPageDescriptor {
	/** 'primary' has a slide image; 'continuation' is text-only. */
	kind: 'primary' | 'continuation';
	/** Index into the images array (only for primary pages). */
	imageIndex?: number;
	/** One-based slide number for the header. */
	slideNumber: number;
	/** Lines of notes text to render on this page. */
	lines: string[];
	/** Y position where notes text starts (PDF coords). */
	notesStartY: number;
	/** For primary pages: pre-computed layout. */
	layout?: ReturnType<typeof calculateNotesPageLayout>;
}

/* ------------------------------------------------------------------ */
/*  Notes PDF builder                                                  */
/* ------------------------------------------------------------------ */

/**
 * Build a PDF with notes pages: each page contains the slide image in the
 * upper 2/3 and speaker notes text in the lower 1/3.
 *
 * Layout follows PowerPoint's "Notes Pages" print layout:
 * - Portrait US Letter (8.5" x 11" / 612 x 792 pt)
 * - Slide image centered in upper portion with a thin border
 * - Notes text wrapped below with Helvetica font
 *
 * If notes text overflows the available space on the primary page,
 * additional continuation pages are emitted with the remaining text
 * and a "Slide N (continued)" header.
 *
 * @param pages - Array of slide canvas + notes pairs.
 * @returns Object URL pointing to the generated PDF blob.
 */
export function buildNotesPdf(pages: NotesPageInput[]): string {
	// Collect JPEG data from canvases
	const images: { bytes: Uint8Array; w: number; h: number }[] = [];
	for (const page of pages) {
		const dataUrl = page.canvas.toDataURL('image/jpeg', 0.92);
		const base64 = dataUrl.split(',')[1] ?? '';
		const raw = atob(base64);
		const bytes = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) {
			bytes[i] = raw.charCodeAt(i);
		}
		images.push({ bytes, w: page.canvas.width, h: page.canvas.height });
	}

	// --- Pass 1: Plan all PDF pages (primary + overflow continuation) ---
	const pdfPages: PdfPageDescriptor[] = [];
	const continuationMaxLines = calculateContinuationPageMaxLines();
	const continuationTextStartY =
		NOTES_PAGE_H - NOTES_MARGIN - NOTES_CONTINUATION_HEADER_SIZE - NOTES_GAP;

	for (let i = 0; i < pages.length; i++) {
		const img = images[i];
		const page = pages[i];
		const layout = calculateNotesPageLayout(img.w, img.h);

		// Wrap notes text
		const contentWidth = NOTES_PAGE_W - 2 * NOTES_MARGIN;
		const wrappedLines =
			page.notes && page.notes.trim().length > 0
				? wrapNotesText(page.notes, contentWidth, NOTES_FONT_SIZE)
				: [];

		// Primary page gets up to maxNotesLines
		const primaryLines = wrappedLines.slice(0, layout.maxNotesLines);
		pdfPages.push({
			kind: 'primary',
			imageIndex: i,
			slideNumber: page.slideNumber,
			lines: primaryLines,
			notesStartY: layout.notesTextY,
			layout,
		});

		// Overflow lines go to continuation pages
		let remaining = wrappedLines.slice(layout.maxNotesLines);
		while (remaining.length > 0) {
			const chunk = remaining.slice(0, continuationMaxLines);
			remaining = remaining.slice(continuationMaxLines);
			pdfPages.push({
				kind: 'continuation',
				slideNumber: page.slideNumber,
				lines: chunk,
				notesStartY: continuationTextStartY,
			});
		}
	}

	// --- Pass 2: Assign object IDs ---
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

	// --- Pass 3: Emit PDF byte-stream ---
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

	// Obj 1: Catalog
	markObj(1);
	emitStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

	// Emit per-page objects
	for (const plan of pageEmitPlan) {
		const desc = plan.descriptor;

		if (desc.kind === 'primary' && plan.imgObjId !== undefined && plan.imgObjId !== null) {
			const img = images[desc.imageIndex!];
			const layout = desc.layout!;

			// Image XObject
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

			// Build content stream: slide image + border + header + notes text
			let content = '';

			// Draw slide image
			content +=
				`q ${layout.imageWidth.toFixed(2)} 0 0 ${layout.imageHeight.toFixed(2)} ` +
				`${layout.imageX.toFixed(2)} ${layout.imageY.toFixed(2)} cm /Img Do Q\n`;

			// Draw border around slide image
			content +=
				`q ${NOTES_BORDER_WIDTH} w 0.6 0.6 0.6 RG ` +
				`${layout.imageX.toFixed(2)} ${layout.imageY.toFixed(2)} ` +
				`${layout.imageWidth.toFixed(2)} ${layout.imageHeight.toFixed(2)} re S Q\n`;

			// Draw separator line between slide and notes
			const separatorY = layout.imageY - NOTES_GAP / 2;
			content +=
				`q 0.5 w 0.75 0.75 0.75 RG ` +
				`${NOTES_MARGIN} ${separatorY.toFixed(2)} m ` +
				`${(NOTES_PAGE_W - NOTES_MARGIN).toFixed(2)} ${separatorY.toFixed(2)} l S Q\n`;

			// Draw slide number header
			content +=
				`BT /F1 9 Tf 0.4 0.4 0.4 rg ` +
				`${NOTES_MARGIN} ${(NOTES_PAGE_H - NOTES_MARGIN + 8).toFixed(2)} Td ` +
				`(${escapePdfText(`Slide ${desc.slideNumber}`)}) Tj ET\n`;

			// Draw notes text
			content += buildNotesTextStream(desc.lines, desc.notesStartY);

			// Page object
			markObj(plan.pageObjId);
			emitStr(
				`${plan.pageObjId} 0 obj\n` +
					`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${NOTES_PAGE_W} ${NOTES_PAGE_H}]` +
					` /Contents ${plan.contObjId} 0 R` +
					` /Resources << /XObject << /Img ${plan.imgObjId} 0 R >>` +
					` /Font << /F1 ${fontObjId} 0 R >> >> >>\n` +
					`endobj\n`,
			);

			// Contents stream
			markObj(plan.contObjId);
			emitStr(
				`${plan.contObjId} 0 obj\n` +
					`<< /Length ${content.length} >>\n` +
					`stream\n${content}\nendstream\nendobj\n`,
			);
		} else {
			// Continuation page (text-only, no slide image)
			let content = '';

			// Draw "Slide N (continued)" header
			content +=
				`BT /F1 ${NOTES_CONTINUATION_HEADER_SIZE} Tf 0.4 0.4 0.4 rg ` +
				`${NOTES_MARGIN} ${(NOTES_PAGE_H - NOTES_MARGIN + 8).toFixed(2)} Td ` +
				`(${escapePdfText(`Slide ${desc.slideNumber} (continued)`)}) Tj ET\n`;

			// Draw notes text
			content += buildNotesTextStream(desc.lines, desc.notesStartY);

			// Page object (no image resources needed)
			markObj(plan.pageObjId);
			emitStr(
				`${plan.pageObjId} 0 obj\n` +
					`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${NOTES_PAGE_W} ${NOTES_PAGE_H}]` +
					` /Contents ${plan.contObjId} 0 R` +
					` /Resources << /Font << /F1 ${fontObjId} 0 R >> >> >>\n` +
					`endobj\n`,
			);

			// Contents stream
			markObj(plan.contObjId);
			emitStr(
				`${plan.contObjId} 0 obj\n` +
					`<< /Length ${content.length} >>\n` +
					`stream\n${content}\nendstream\nendobj\n`,
			);
		}
	}

	// Font object (Helvetica -- built-in, no embedding needed)
	markObj(fontObjId);
	emitStr(
		`${fontObjId} 0 obj\n` +
			`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n` +
			`endobj\n`,
	);

	// Obj 2: Pages
	const pagesKids = pageObjIds.map((id) => `${id} 0 R`).join(' ');
	markObj(2);
	emitStr(`2 0 obj\n<< /Type /Pages /Kids [${pagesKids}] /Count ${pdfPages.length} >>\nendobj\n`);

	// Cross-reference table
	const xrefPos = pos;
	const totalObjs = objCount + 1; // +1 for free entry (obj 0)
	emitStr(`xref\n0 ${totalObjs}\n`);
	emitStr('0000000000 65535 f \n');

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
