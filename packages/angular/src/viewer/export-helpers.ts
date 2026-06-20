/**
 * Pure export helper utilities: thin re-export shim.
 *
 * The page-size / orientation / file-name maths now lives once in
 * `pptx-viewer-shared` (`export/pdf-page-size`), inlined here at build time via
 * `../internal/shared-src`. This module preserves the historical import path for
 * the Angular export service, components, and tests.
 */
export {
	pdfOrientation,
	pdfPageSize,
	sanitizeFileName,
	slideFileName,
} from '../internal/shared-src/export/pdf-page-size';
