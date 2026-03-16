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
 * Trigger a browser download for the given Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	setTimeout(() => {
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, 200);
}
