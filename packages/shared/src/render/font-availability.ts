/** Minimal browser FontFaceSet surface used by the viewer bindings. */
export interface FontAvailabilitySource {
	readonly ready: PromiseLike<unknown>;
	check(font: string): boolean;
}

function browserFontSource(): FontAvailabilitySource | undefined {
	return typeof document === 'undefined' ? undefined : document.fonts;
}

/** Check whether a font family resolves through the browser font set. */
export function isFontFamilyAvailable(
	family: string,
	source: FontAvailabilitySource | undefined = browserFontSource(),
): boolean {
	if (!source) {
		return false;
	}
	try {
		const escaped = family.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		return source.check(`12px "${escaped}"`);
	} catch {
		return false;
	}
}

/** Wait for fonts to settle, then return every locally available family. */
export async function scanAvailableFontFamilies(
	families: readonly string[],
	source: FontAvailabilitySource | undefined = browserFontSource(),
): Promise<Set<string>> {
	if (!source) {
		return new Set();
	}
	try {
		await source.ready;
		return new Set(families.filter((family) => isFontFamilyAvailable(family, source)));
	} catch {
		return new Set();
	}
}
