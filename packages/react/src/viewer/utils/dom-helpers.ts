/**
 * DOM utility helpers: escapeHtml, safePrompt, safeConfirm, downloadBlob.
 *
 * `sanitizeDownloadFilename` and `downloadBlob` now live once in
 * `pptx-viewer-shared` (`export/download-helpers`), which sanitizes every
 * filename internally, so this module just re-exports them and keeps the
 * historical React import path.
 */
export { downloadBlob, sanitizeDownloadFilename } from 'pptx-viewer-shared';

// HTML entity escaping is shared (see `export/print-document`).
export { escapeHtml } from 'pptx-viewer-shared';

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
