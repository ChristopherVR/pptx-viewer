/**
 * Colour comparison shared by the parity harnesses.
 *
 * Extracted from `support/parity` so that the style-level diff modules can use
 * it without a runtime cycle (parity imports the style diff, which needs the
 * colour comparison parity used to own).
 *
 * @module e2e/support/color-match
 */

function parseColor(value: string): [number, number, number, number] | null {
	const match = /rgba?\(([^)]+)\)/u.exec(value);
	if (!match) {
		return null;
	}
	const parts = match[1].split(/[,/]/u).map((part) => Number.parseFloat(part));
	if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
		return null;
	}
	return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

/** True when two computed colours are the same to within `tolerance` per channel. */
export function colorsMatch(a: string, b: string, tolerance: number): boolean {
	if (a === b) {
		return true;
	}
	const left = parseColor(a);
	const right = parseColor(b);
	if (!left || !right) {
		return false;
	}
	// Fully transparent paints look identical whatever their nominal channels.
	if (left[3] === 0 && right[3] === 0) {
		return true;
	}
	return (
		Math.abs(left[0] - right[0]) <= tolerance &&
		Math.abs(left[1] - right[1]) <= tolerance &&
		Math.abs(left[2] - right[2]) <= tolerance &&
		Math.abs(left[3] - right[3]) <= 0.05
	);
}

/**
 * True when two strings that may EMBED computed colours (border shorthands,
 * box-shadows, gradients) match once their `rgb()`/`rgba()` runs are compared
 * channel-wise with `tolerance` and everything around them is compared exactly.
 *
 * Bindings resolve the same theme colour through different code paths and can
 * land one channel apart after rounding; a plain string equality would report
 * every such border and shadow as a parity break.
 */
export function stringsMatchWithColors(a: string, b: string, tolerance: number): boolean {
	if (a === b) {
		return true;
	}
	const colorRun = /rgba?\([^)]*\)/gu;
	const leftColors = a.match(colorRun) ?? [];
	const rightColors = b.match(colorRun) ?? [];
	if (leftColors.length !== rightColors.length) {
		return false;
	}
	if (a.replace(colorRun, '#c') !== b.replace(colorRun, '#c')) {
		return false;
	}
	return leftColors.every((color, index) => colorsMatch(color, rightColors[index], tolerance));
}
