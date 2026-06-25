/**
 * Canvas -> JPEG byte extraction shared by every binding's PDF export. This is
 * the one DOM-touching step of the slides/notes PDF pipeline that was duplicated
 * per binding: it reads `canvas.toDataURL('image/jpeg', q)`, base64-decodes the
 * payload, and returns a {@link PdfImageData} ready for `pdf-slides` /
 * `pdf-notes-builder` byte assembly.
 */

import type { PdfImageData } from './pdf-notes-layout';

/**
 * Convert an HTMLCanvasElement to JPEG bytes suitable for PDF embedding.
 *
 * Call this immediately after rendering each slide, then discard the canvas to
 * free the large pixel buffer (~33 MB at 2x 1920x1080). The resulting JPEG is
 * typically 200-500 KB.
 *
 * @param canvas  - The rendered slide canvas.
 * @param quality - JPEG quality (0 to 1). Defaults to 0.92.
 * @returns Pre-converted image data ({ bytes, w, h }) for PDF embedding.
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
