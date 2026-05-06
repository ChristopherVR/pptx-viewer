/**
 * DOM utility helpers — escapeHtml, safePrompt, safeConfirm, downloadBlob.
 */

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
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
 * Strip control characters, filesystem-reserved characters, and path-traversal
 * sequences from a user-supplied download filename. CR/LF in particular can
 * corrupt `Content-Disposition` headers when a server-side proxy re-emits the
 * download name; leading dots can produce hidden files; the rest are simply
 * disallowed by Windows or unsafe to render in UI.
 *
 * Empty / whitespace-only input falls back to `presentation.pptx`.
 */
export function sanitizeDownloadFilename(input: string | undefined | null): string {
	if (typeof input !== 'string' || input.trim().length === 0) {
		return 'presentation.pptx';
	}
	let cleaned = input
		// eslint-disable-next-line no-control-regex
		.replace(/[\x00-\x1f\x7f"\\/:*?<>|]/g, '_')
		.replace(/\.\./g, '__')
		.replace(/^\.+/, '')
		.trim();
	if (cleaned.length === 0) {
		return 'presentation.pptx';
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
 * Trigger a browser download for the given Blob.
 *
 * The filename is run through {@link sanitizeDownloadFilename} so that hostile
 * inputs (CR/LF, path-traversal segments, control chars) cannot influence the
 * `<a download>` value or downstream `Content-Disposition` headers.
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const safeName = sanitizeDownloadFilename(filename);
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = safeName;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 200);
}
