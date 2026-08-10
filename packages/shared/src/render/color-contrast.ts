/**
 * Readable-text-colour selection for fills whose text colour was left implicit.
 *
 * PowerPoint stores no colour for a great many runs and resolves one at paint
 * time from what is behind them. Renderers that instead pick a fixed colour get
 * white text on white panels, so both the 2D and 3D SmartArt paths need the same
 * decision, made the same way.
 *
 * @module color-contrast
 */

/** Parse `#rgb`/`#rrggbb` into `[r, g, b]` (0..255); falls back to mid-grey. */
export function parseHex(hex: string): [number, number, number] {
	let h = hex.trim().replace(/^#/u, '');
	if (h.length === 3) {
		h = h
			.split('')
			.map((c) => c + c)
			.join('');
	}
	if (h.length !== 6 || /[^0-9a-fA-F]/u.test(h)) {
		return [128, 128, 128];
	}
	return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Pick a readable text colour (near-black or near-white) for a given fill,
 * using the WCAG relative-luminance threshold.
 */
export function contrastTextColor(fill: string): string {
	const [r, g, b] = parseHex(fill);
	const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return lum > 0.6 ? '#1a1a1a' : '#ffffff';
}
