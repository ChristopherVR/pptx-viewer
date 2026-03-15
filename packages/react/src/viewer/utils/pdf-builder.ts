/**
 * PDF layout mode for export.
 *
 * - `'slides'`   — landscape pages, one slide image per page (default)
 * - `'notes'`    — portrait pages, slide image in top 2/3 with notes text below
 * - `'handouts'` — reserved for future handout layouts (2/3/4/6 slides per page)
 */
export type PdfLayoutMode = "slides" | "notes" | "handouts";

/** Slide data paired with its speaker notes for notes-page PDF export. */
export interface NotesPageInput {
  /** Captured slide canvas (JPEG-encoded internally). */
  canvas: HTMLCanvasElement;
  /** Plain-text speaker notes for this slide (may be empty/undefined). */
  notes?: string;
  /** One-based slide number for the header. */
  slideNumber: number;
}

/* ------------------------------------------------------------------ */
/*  Notes-page layout constants (US Letter portrait, 8.5" × 11")     */
/* ------------------------------------------------------------------ */

/** US Letter portrait width in PDF points (8.5 × 72). */
export const NOTES_PAGE_W = 612;
/** US Letter portrait height in PDF points (11 × 72). */
export const NOTES_PAGE_H = 792;
/** Page margin in points. */
export const NOTES_MARGIN = 36; // 0.5 inch
/** Fraction of the usable height allocated to the slide image area. */
export const NOTES_SLIDE_FRACTION = 2 / 3;
/** Gap between slide image area and notes text in points. */
export const NOTES_GAP = 18;
/** Font size for notes text in points. */
export const NOTES_FONT_SIZE = 11;
/** Line height multiplier for notes text. */
export const NOTES_LINE_HEIGHT = 1.4;
/** Border width around the slide image in points. */
export const NOTES_BORDER_WIDTH = 0.5;

/* ------------------------------------------------------------------ */
/*  Notes-page layout calculation (pure, testable)                    */
/* ------------------------------------------------------------------ */

/**
 * Calculate the layout geometry for a single notes page.
 *
 * This is a pure function with no DOM dependencies, making it easy to test.
 *
 * @param slideWidth   - Pixel width of the captured slide canvas.
 * @param slideHeight  - Pixel height of the captured slide canvas.
 * @returns Layout rectangles in PDF points for the slide image and notes area.
 */
export function calculateNotesPageLayout(
  slideWidth: number,
  slideHeight: number,
): {
  /** Available content width (page minus margins). */
  contentWidth: number;
  /** Available content height (page minus margins). */
  contentHeight: number;
  /** Height allocated to the slide image area. */
  slideAreaHeight: number;
  /** Height allocated to the notes text area. */
  notesAreaHeight: number;
  /** Rendered slide image width (aspect-ratio preserved). */
  imageWidth: number;
  /** Rendered slide image height (aspect-ratio preserved). */
  imageHeight: number;
  /** X position of the slide image (centered). */
  imageX: number;
  /** Y position of the slide image (PDF coords, origin at bottom-left). */
  imageY: number;
  /** Y position where notes text starts (PDF coords, origin at bottom-left). */
  notesTextY: number;
  /** Maximum number of notes text lines that fit. */
  maxNotesLines: number;
} {
  const contentWidth = NOTES_PAGE_W - 2 * NOTES_MARGIN;
  const contentHeight = NOTES_PAGE_H - 2 * NOTES_MARGIN;
  const slideAreaHeight = contentHeight * NOTES_SLIDE_FRACTION;
  const notesAreaHeight =
    contentHeight - slideAreaHeight - NOTES_GAP;

  // Fit slide image within the slide area, preserving aspect ratio
  const scale = Math.min(
    contentWidth / slideWidth,
    slideAreaHeight / slideHeight,
  );
  const imageWidth = slideWidth * scale;
  const imageHeight = slideHeight * scale;

  // Center the image horizontally within content area
  const imageX = NOTES_MARGIN + (contentWidth - imageWidth) / 2;

  // Position image at top of content area (PDF y-axis: bottom = 0)
  const slideAreaTop = NOTES_PAGE_H - NOTES_MARGIN;
  const imageY = slideAreaTop - imageHeight;

  // Notes text starts below the slide area + gap
  const notesTextY = imageY - NOTES_GAP;

  // Calculate maximum lines that fit in the notes area
  const lineHeightPt = NOTES_FONT_SIZE * NOTES_LINE_HEIGHT;
  const maxNotesLines = Math.floor(notesAreaHeight / lineHeightPt);

  return {
    contentWidth,
    contentHeight,
    slideAreaHeight,
    notesAreaHeight,
    imageWidth,
    imageHeight,
    imageX,
    imageY,
    notesTextY,
    maxNotesLines,
  };
}

/**
 * Wrap a text string into lines that fit within a given width at a given font size.
 *
 * Uses approximate character widths (monospace-ish estimation) since we cannot
 * measure actual glyph widths without a full font engine. This is acceptable for
 * speaker notes which are typically plain text.
 *
 * @param text       - The text to wrap.
 * @param maxWidth   - Maximum line width in PDF points.
 * @param fontSize   - Font size in PDF points.
 * @returns Array of wrapped text lines.
 */
export function wrapNotesText(
  text: string,
  maxWidth: number,
  fontSize: number,
): string[] {
  if (!text || text.trim().length === 0) return [];

  // Approximate average character width as 0.5 × fontSize for Helvetica
  const avgCharWidth = fontSize * 0.5;
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

  if (maxCharsPerLine <= 0) return [];

  const lines: string[] = [];
  // Split on explicit newlines first
  const paragraphs = text.split(/\r?\n/);

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Escape special PDF text characters in a string for use in Tj operators.
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
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
 * @param pages - Array of slide canvas + notes pairs.
 * @returns Object URL pointing to the generated PDF blob.
 */
export function buildNotesPdf(pages: NotesPageInput[]): string {
  // Collect JPEG data from canvases
  const images: { bytes: Uint8Array; w: number; h: number }[] = [];
  for (const page of pages) {
    const dataUrl = page.canvas.toDataURL("image/jpeg", 0.92);
    const base64 = dataUrl.split(",")[1] ?? "";
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    images.push({ bytes, w: page.canvas.width, h: page.canvas.height });
  }

  // --- Build PDF byte-stream ---
  // Object layout per page:
  //   obj 3 + i*3     = Image XObject
  //   obj 3 + i*3 + 1 = Page
  //   obj 3 + i*3 + 2 = Contents stream
  // Plus: obj 1 = Catalog, obj 2 = Pages, obj (3 + pages*3) = Font

  const fontObjId = 3 + pages.length * 3;
  const objCount = 2 + pages.length * 3 + 1; // catalog + pages + 3 per page + font
  const pageObjIds: number[] = [];

  const segments: (string | Uint8Array)[] = [];
  const offsets: number[] = [];
  let pos = 0;

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

  emitStr("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // Obj 1: Catalog
  markObj();
  emitStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Write per-page objects
  for (let i = 0; i < pages.length; i++) {
    const img = images[i];
    const page = pages[i];
    const imgObjId = 3 + i * 3;
    const pageObjId = 3 + i * 3 + 1;
    const contObjId = 3 + i * 3 + 2;
    pageObjIds.push(pageObjId);

    const layout = calculateNotesPageLayout(img.w, img.h);

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
    emitStr("\nendstream\nendobj\n");

    // Build content stream: slide image + border + notes text
    let content = "";

    // Draw slide image
    content +=
      `q ${layout.imageWidth.toFixed(2)} 0 0 ${layout.imageHeight.toFixed(2)} ` +
      `${layout.imageX.toFixed(2)} ${layout.imageY.toFixed(2)} cm /Img${i} Do Q\n`;

    // Draw border around slide image
    content +=
      `q ${NOTES_BORDER_WIDTH} w 0.6 0.6 0.6 RG ` +
      `${layout.imageX.toFixed(2)} ${layout.imageY.toFixed(2)} ` +
      `${layout.imageWidth.toFixed(2)} ${layout.imageHeight.toFixed(2)} re S Q\n`;

    // Draw slide number header
    content +=
      `BT /F1 9 Tf 0.4 0.4 0.4 rg ` +
      `${NOTES_MARGIN} ${(NOTES_PAGE_H - NOTES_MARGIN + 8).toFixed(2)} Td ` +
      `(${escapePdfText(`Slide ${page.slideNumber}`)}) Tj ET\n`;

    // Draw notes text
    if (page.notes && page.notes.trim().length > 0) {
      const wrappedLines = wrapNotesText(
        page.notes,
        layout.contentWidth,
        NOTES_FONT_SIZE,
      );
      const lineHeightPt = NOTES_FONT_SIZE * NOTES_LINE_HEIGHT;
      const linesToRender = wrappedLines.slice(0, layout.maxNotesLines);

      content += `BT /F1 ${NOTES_FONT_SIZE} Tf 0 0 0 rg `;
      content += `${NOTES_MARGIN} ${layout.notesTextY.toFixed(2)} Td `;

      for (let li = 0; li < linesToRender.length; li++) {
        const line = linesToRender[li];
        if (li === 0) {
          content += `(${escapePdfText(line)}) Tj `;
        } else {
          content += `0 ${(-lineHeightPt).toFixed(2)} Td (${escapePdfText(line)}) Tj `;
        }
      }
      content += "ET\n";
    }

    // Page object with font resource
    markObj();
    emitStr(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${NOTES_PAGE_W} ${NOTES_PAGE_H}]` +
        ` /Contents ${contObjId} 0 R` +
        ` /Resources << /XObject << /Img${i} ${imgObjId} 0 R >>` +
        ` /Font << /F1 ${fontObjId} 0 R >> >> >>\n` +
        `endobj\n`,
    );

    // Contents stream
    markObj();
    emitStr(
      `${contObjId} 0 obj\n` +
        `<< /Length ${content.length} >>\n` +
        `stream\n${content}\nendstream\nendobj\n`,
    );
  }

  // Font object (Helvetica — built-in, no embedding needed)
  markObj();
  emitStr(
    `${fontObjId} 0 obj\n` +
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n` +
      `endobj\n`,
  );

  // Obj 2: Pages
  const pagesKids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  offsets.splice(1, 0, pos); // insert at index 1 for obj 2
  emitStr(
    `2 0 obj\n<< /Type /Pages /Kids [${pagesKids}] /Count ${pages.length} >>\nendobj\n`,
  );

  // Cross-reference table
  const xrefPos = pos;
  const totalObjs = objCount + 1; // +1 for free entry
  emitStr(`xref\n0 ${totalObjs}\n`);
  emitStr("0000000000 65535 f \n");

  for (let i = 0; i < objCount; i++) {
    const off = offsets[i] ?? 0;
    emitStr(`${String(off).padStart(10, "0")} 00000 n \n`);
  }

  emitStr(
    `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\n` +
      `startxref\n${xrefPos}\n%%EOF\n`,
  );

  // Merge segments into a single Uint8Array
  const encoder = new TextEncoder();
  let totalLen = 0;
  const encoded = segments.map((s) => {
    if (typeof s === "string") {
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

  const blob = new Blob([result], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/* ------------------------------------------------------------------ */
/*  Original slides-only PDF builder                                   */
/* ------------------------------------------------------------------ */

/**
 * Minimal PDF builder: takes one or more HTMLCanvasElement captures
 * and produces a data-URL PDF (no external library needed).
 *
 * Each canvas becomes a full page in landscape A4 (842 x 595 pt).
 * The image is JPEG-encoded and placed to fill the page while
 * preserving aspect ratio.
 */
export function buildPdfFromCanvases(canvases: HTMLCanvasElement[]): string {
  const PAGE_W = 842; // A4 landscape width in pt
  const PAGE_H = 595; // A4 landscape height in pt

  // Collect JPEG data and byte lengths first
  const images: { bytes: Uint8Array; w: number; h: number }[] = [];
  for (const canvas of canvases) {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const base64 = dataUrl.split(",")[1] ?? "";
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    images.push({ bytes, w: canvas.width, h: canvas.height });
  }

  // --- Build a minimal valid PDF 1.4 byte-stream ---
  const parts: string[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const emit = (s: string) => {
    parts.push(s);
    pos += s.length;
  };

  emit("%PDF-1.4\n");

  // We create objects in order:
  // 1 = Catalog, 2 = Pages, then per image: (imageObj, pageObj, contentsObj), Resources aggregated per-page inline
  const objCount = 2 + images.length * 3; // catalog + pages + 3 per image
  const pageObjIds: number[] = [];

  // --- Object 1: Catalog ---
  offsets.push(pos);
  emit("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // --- Placeholder for Pages (object 2) — write after we know page obj ids ---
  // We'll write all image stream objects first, then pages, then contents, then the Pages dict.
  // Actually, let's plan object IDs:
  // obj 1 = Catalog
  // obj 2 = Pages
  // For page i (0-based):
  //   obj 3 + i*3     = Image XObject
  //   obj 3 + i*3 + 1 = Page
  //   obj 3 + i*3 + 2 = Contents stream

  // Write Images first so we know stream offsets
  // We need to track byte position carefully for binary streams.
  // Instead, build the whole PDF as a Uint8Array at the end.
  // Let's switch to a simpler approach: build the PDF as an array of
  // (string | Uint8Array) segments and track offsets.

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

  emitStr("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // Obj 1: Catalog
  markObj();
  emitStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Reserve obj 2 for Pages — write last before xref
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
    emitStr("\nendstream\nendobj\n");

    // Page object
    markObj();
    emitStr(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}]` +
        ` /Contents ${contObjId} 0 R` +
        ` /Resources << /XObject << /Img${i} ${imgObjId} 0 R >> >> >>\n` +
        `endobj\n`,
    );

    // Contents stream — draw image
    const contentStream = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Img${i} Do Q`;
    markObj();
    emitStr(
      `${contObjId} 0 obj\n` +
        `<< /Length ${contentStream.length} >>\n` +
        `stream\n${contentStream}\nendstream\nendobj\n`,
    );
  }

  // Obj 2: Pages
  const pagesKids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  offsets.splice(1, 0, pos); // insert at index 1 since obj 2 is written now
  emitStr(
    `2 0 obj\n<< /Type /Pages /Kids [${pagesKids}] /Count ${images.length} >>\nendobj\n`,
  );

  // Cross-reference table
  const xrefPos = pos;
  const totalObjs = objCount + 1; // +1 for free entry
  emitStr(`xref\n0 ${totalObjs}\n`);
  emitStr("0000000000 65535 f \n");

  // Sort offsets by object number — we stored them in write order, need them in obj-id order
  // obj 1 is offsets[0], obj 2 is offsets[1] (we spliced it), then obj 3..N are offsets[2..]
  for (let i = 0; i < objCount; i++) {
    const off = offsets[i] ?? 0;
    emitStr(`${String(off).padStart(10, "0")} 00000 n \n`);
  }

  emitStr(
    `trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\n` +
      `startxref\n${xrefPos}\n%%EOF\n`,
  );

  // Merge segments into a single Uint8Array
  const encoder = new TextEncoder();
  let totalLen = 0;
  const encoded = segments.map((s) => {
    if (typeof s === "string") {
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

  const blob = new Blob([result], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}
