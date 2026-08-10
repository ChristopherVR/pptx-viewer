/**
 * Word wrapping for contexts where the real glyph advances cannot be measured.
 *
 * Some render targets have no text-measurement API available at the point the
 * layout is decided: a PDF content stream being assembled, or SVG labels that
 * must be laid out before the document is in a document. Both need to break a
 * string into lines that will roughly fit a width, and both are better served
 * by one approximation than by two that drift apart.
 *
 * This is deliberately not a substitute for measured text. Anything that can
 * measure (the paragraph renderers, which resolve real advances) must.
 *
 * @module text-wrap-estimate
 */

/** Average glyph advance as a fraction of the font size, across mixed-case Latin text. */
const AVERAGE_ADVANCE_RATIO = 0.5;

/** Options for {@link wrapTextByEstimatedWidth}. */
export interface EstimatedWrapOptions {
	/**
	 * Keep an empty line for each blank authored paragraph. Paginated text wants
	 * the vertical gap preserved; a label centred in a shape does not.
	 */
	keepBlankLines?: boolean;
}

/**
 * Break `text` into lines that approximately fit `maxWidth`.
 *
 * Authored line breaks are always honoured. Words are never split or dropped:
 * a single word longer than the line gets a line of its own and overflows,
 * which is what PowerPoint does too.
 *
 * @param text - The text to wrap.
 * @param maxWidth - Available width, in the same units as `fontSize`.
 * @param fontSize - Font size used to estimate glyph advances.
 * @param options - See {@link EstimatedWrapOptions}.
 * @returns The wrapped lines, empty when there is nothing to render.
 */
export function wrapTextByEstimatedWidth(
	text: string,
	maxWidth: number,
	fontSize: number,
	options: EstimatedWrapOptions = {},
): string[] {
	if (!text || text.trim().length === 0) {
		return [];
	}

	const charactersPerLine = Math.floor(maxWidth / Math.max(fontSize * AVERAGE_ADVANCE_RATIO, 1));
	if (charactersPerLine <= 0) {
		return [];
	}

	const lines: string[] = [];
	for (const paragraph of text.split(/\r?\n/u)) {
		if (paragraph.trim().length === 0) {
			if (options.keepBlankLines) {
				lines.push('');
			}
			continue;
		}

		let current = '';
		for (const word of paragraph.split(/\s+/u)) {
			if (current.length === 0) {
				current = word;
			} else if (current.length + 1 + word.length <= charactersPerLine) {
				current += ` ${word}`;
			} else {
				lines.push(current);
				current = word;
			}
		}
		if (current.length > 0) {
			lines.push(current);
		}
	}

	return lines;
}
