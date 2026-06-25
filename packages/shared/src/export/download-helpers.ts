/**
 * Browser download helpers shared by every binding's export pipeline. These are
 * the only DOM-touching helpers in the shared export subtree: they create a
 * transient `<a download>`, click it, and revoke the object URL after a short
 * delay. The richer `sanitizeDownloadFilename` guard (null/traversal/length)
 * also lives here so any binding can sanitize before handing a name to
 * {@link downloadBlob}.
 *
 * The standard revoke delay is 200ms: long enough for the browser to begin the
 * download, short enough not to leak the object URL.
 */

/** Default fallback name used when a download filename is empty or unusable. */
const FALLBACK_DOWNLOAD_NAME = 'presentation.pptx';

/** Revoke delay (ms) after triggering a download click. */
const REVOKE_DELAY_MS = 200;

/**
 * Strip control characters, filesystem-reserved characters, and path-traversal
 * sequences from a user-supplied download filename. CR/LF in particular can
 * corrupt `Content-Disposition` headers when a server-side proxy re-emits the
 * download name; leading dots can produce hidden files; the rest are simply
 * disallowed by Windows or unsafe to render in UI.
 *
 * Empty / whitespace-only input (or a non-string) falls back to
 * `presentation.pptx`. Over-long names are truncated to 200 chars, preserving a
 * short trailing extension when present.
 *
 * @param input - The raw, possibly hostile filename.
 * @returns A filesystem-safe download name (never empty).
 */
export function sanitizeDownloadFilename(input: string | undefined | null): string {
	if (typeof input !== 'string' || input.trim().length === 0) {
		return FALLBACK_DOWNLOAD_NAME;
	}
	let cleaned = input
		// eslint-disable-next-line no-control-regex
		.replace(/[\x00-\x1f\x7f"\\/:*?<>|]/gu, '_')
		.replace(/\.\./gu, '__')
		.replace(/^\.+/u, '')
		.trim();
	if (cleaned.length === 0) {
		return FALLBACK_DOWNLOAD_NAME;
	}
	if (cleaned.length > 200) {
		// Preserve the extension when truncating.
		const dot = cleaned.lastIndexOf('.');
		if (dot > 0 && cleaned.length - dot <= 16) {
			const ext = cleaned.slice(dot);
			cleaned = cleaned.slice(0, 200 - ext.length) + ext;
		} else {
			cleaned = cleaned.slice(0, 200);
		}
	}
	return cleaned;
}

/**
 * Trigger a browser download for a Blob. The `filename` is used verbatim: pass a
 * name through {@link sanitizeDownloadFilename} first if it may be hostile.
 *
 * @param blob     - The content to download.
 * @param filename - The suggested download name.
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	// Defer cleanup so the browser has time to start the download.
	setTimeout(() => {
		anchor.remove();
		URL.revokeObjectURL(url);
	}, REVOKE_DELAY_MS);
}

/**
 * Trigger a browser download for a data-URL string. The `filename` is used
 * verbatim: sanitize first if it may be hostile.
 *
 * @param dataUrl  - The `data:` (or object) URL to download.
 * @param filename - The suggested download name.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
	const anchor = document.createElement('a');
	anchor.href = dataUrl;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	setTimeout(() => {
		anchor.remove();
	}, REVOKE_DELAY_MS);
}
