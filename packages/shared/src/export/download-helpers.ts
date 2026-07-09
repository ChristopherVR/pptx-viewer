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
 * Revoke delay (ms) after opening a payload in a new tab. Longer than the
 * download delay: the new document may still be fetching the object URL (a PDF
 * viewer, an image) well after the current task finishes, so we keep the URL
 * alive for a minute before releasing it.
 */
const OPEN_REVOKE_DELAY_MS = 60_000;

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

/**
 * Convert a `data:` URL into a {@link Blob}, preserving its MIME type. Handles
 * both base64 and percent-encoded payloads. Returns `undefined` for a non-data
 * URL or a payload that cannot be decoded, so callers can fall back gracefully.
 *
 * @param dataUrl - A `data:` URL string.
 */
export function dataUrlToBlob(dataUrl: string): Blob | undefined {
	const match = /^data:(?<mime>[^;,]*)(?<base64>;base64)?,(?<payload>[\s\S]*)$/u.exec(dataUrl);
	if (!match?.groups) {
		return undefined;
	}
	const mime = match.groups.mime || 'application/octet-stream';
	const isBase64 = Boolean(match.groups.base64);
	const payload = match.groups.payload ?? '';
	try {
		if (isBase64) {
			const binary = atob(payload);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			return new Blob([bytes], { type: mime });
		}
		return new Blob([decodeURIComponent(payload)], { type: mime });
	} catch {
		return undefined;
	}
}

/**
 * Open a payload in a new browser tab. Chromium (and other browsers) silently
 * refuse to navigate a new top-level browsing context straight to a `data:`
 * URL, so a data URL is first converted to a Blob object URL - which browsers
 * do allow a new tab to open - and revoked after {@link OPEN_REVOKE_DELAY_MS}
 * once the new document has had time to fetch it. Non-`data:` URLs (http(s),
 * blob) are opened as-is.
 *
 * @param url - The payload URL (typically a recovered `data:` URL).
 */
export function openUrlInNewTab(url: string): void {
	const blob = url.startsWith('data:') ? dataUrlToBlob(url) : undefined;
	const target = blob ? URL.createObjectURL(blob) : url;
	// NB: no `noopener` here. A `blob:` object URL is resolved from the opener's
	// origin-partitioned blob store, and Chromium refuses to resolve it in the
	// disconnected browsing context `noopener` creates (the new tab lands on an
	// empty document). We instead sever the child's back-reference to us
	// afterwards, which mitigates reverse-tabnabbing without breaking the blob.
	const opened = window.open(target, '_blank');
	if (opened) {
		try {
			opened.opener = null;
		} catch {
			// Some browsers disallow reassigning `opener`; best-effort only.
		}
	}
	if (blob) {
		setTimeout(() => {
			URL.revokeObjectURL(target);
		}, OPEN_REVOKE_DELAY_MS);
	}
}
