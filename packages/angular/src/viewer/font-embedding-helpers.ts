/**
 * font-embedding-helpers.ts: font-availability probing for the font-embedding
 * panel. Thin wrappers around `document.fonts` kept in one module so the panel
 * component stays a thin view + wiring layer.
 */

/**
 * Whether a font family resolves in the current browser. Pure guard around
 * `document.fonts.check`; returns false in non-DOM environments or on error.
 */
export function checkFontAvailable(family: string): boolean {
	if (typeof document === 'undefined') {
		return false;
	}
	try {
		return document.fonts.check(`12px "${family}"`);
	} catch {
		return false;
	}
}

/**
 * Wait for fonts to settle, then return the subset of `families` that resolve
 * in the current browser. Never throws; returns an empty set on failure.
 */
export async function scanAvailableFonts(families: readonly string[]): Promise<Set<string>> {
	try {
		if (typeof document !== 'undefined') {
			await document.fonts.ready;
		}
		const found = new Set<string>();
		for (const family of families) {
			if (checkFontAvailable(family)) {
				found.add(family);
			}
		}
		return found;
	} catch {
		return new Set<string>();
	}
}
