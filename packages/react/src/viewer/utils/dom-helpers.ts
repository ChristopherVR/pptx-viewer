/**
 * DOM utility helpers: escapeHtml, safePrompt, safeConfirm, downloadBlob.
 *
 * `sanitizeDownloadFilename` and the underlying object-URL anchor-click download
 * now live once in `pptx-viewer-shared` (`export/download-helpers`); this module
 * re-exports the sanitizer and keeps a thin `downloadBlob` wrapper that
 * sanitizes the name before delegating, preserving the historical (sanitizing)
 * behaviour of the React import path.
 */
import { downloadBlob as sharedDownloadBlob, sanitizeDownloadFilename } from 'pptx-viewer-shared';

export { sanitizeDownloadFilename };

export function escapeHtml(value: string): string {
	return value
		.replace(/&/gu, '&amp;')
		.replace(/</gu, '&lt;')
		.replace(/>/gu, '&gt;')
		.replace(/"/gu, '&quot;')
		.replace(/'/gu, '&#39;');
}

export function safePrompt(message: string, defaultValue?: string): string | null {
	try {
		return window.prompt(message, defaultValue);
	} catch {
		return null;
	}
}

export function safeConfirm(message: string): boolean {
	try {
		return window.confirm(message);
	} catch {
		return false;
	}
}

/**
 * Trigger a browser download for the given Blob.
 *
 * The filename is run through {@link sanitizeDownloadFilename} so that hostile
 * inputs (CR/LF, path-traversal segments, control chars) cannot influence the
 * `<a download>` value or downstream `Content-Disposition` headers, then
 * delegated to the shared object-URL anchor-click download.
 */
export function downloadBlob(blob: Blob, filename: string): void {
	sharedDownloadBlob(blob, sanitizeDownloadFilename(filename));
}
