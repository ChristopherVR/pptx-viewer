/**
 * Tab stop leader character rendering utilities.
 *
 * OOXML tab stops can specify a leader character that fills the gap between the
 * preceding text and the tab stop position. This module provides the mapping
 * from OOXML leader types to repeated characters and CSS styles for rendering
 * them. Framework-agnostic; each binding maps the returned style map onto its
 * own style binding.
 */

/**
 * Map an OOXML tab leader type to the character used to fill the tab gap.
 * Returns `undefined` for 'none' or unknown types.
 */
export function getLeaderCharacter(leader: string | undefined): string | undefined {
	switch (leader) {
		case 'dot':
			return '.';
		case 'hyphen':
			return '-';
		case 'underscore':
			return '_';
		case 'heavy':
			return '━'; // box-drawing heavy horizontal
		case 'middleDot':
			return '·'; // middle dot
		default:
			return undefined;
	}
}

/**
 * Build inline CSS for a tab leader span.
 *
 * The leader span is rendered as an inline-block element that fills the tab gap
 * width with repeated leader characters.
 *
 * @param widthPx - Width of the tab gap in pixels.
 * @param color - Text colour to inherit.
 * @returns CSS properties for the leader span, or undefined if width is non-positive.
 */
export function getLeaderStyles(
	widthPx: number,
	color?: string,
): Record<string, string | number> | undefined {
	if (widthPx <= 0) {
		return undefined;
	}
	return {
		display: 'inline-block',
		width: `${widthPx}px`,
		overflow: 'hidden',
		whiteSpace: 'pre',
		verticalAlign: 'baseline',
		...(color ? { color } : {}),
	};
}

/**
 * Generate a string of repeated leader characters sufficient to fill the given
 * pixel width. Assumes ~0.6em per character at the given font size.
 *
 * @param leader - The OOXML leader type.
 * @param widthPx - Width of the tab gap in pixels.
 * @param fontSizePx - Font size in pixels (default 16).
 * @returns The repeated leader string, or a plain tab character if no leader.
 */
export function buildLeaderString(
	leader: string | undefined,
	widthPx: number,
	fontSizePx: number = 16,
): string {
	const char = getLeaderCharacter(leader);
	if (!char || widthPx <= 0) {
		return '\t';
	}

	// Approximate character width as 0.6 x font size.
	const charWidth = Math.max(1, fontSizePx * 0.6);
	const count = Math.max(1, Math.ceil(widthPx / charWidth));
	return char.repeat(count);
}
