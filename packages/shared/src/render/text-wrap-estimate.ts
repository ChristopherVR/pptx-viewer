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

function estimatedGlyphAdvanceRatio(glyph: string): number {
	if (/\p{Mark}/u.test(glyph)) {
		return 0;
	}
	if (/\s/u.test(glyph)) {
		return 0.33;
	}
	if (
		/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}]/u.test(
			glyph,
		)
	) {
		return 1;
	}
	if (/[A-Z]/u.test(glyph)) {
		return 0.65;
	}
	if (/[a-z0-9]/u.test(glyph)) {
		return 0.55;
	}
	if (/[,.;:!?()\u005b\u005d{}'"`\-_/\\]/u.test(glyph)) {
		return 0.35;
	}
	return 0.6;
}

function estimatedTextWidth(glyphs: readonly string[], fontSize: number): number {
	return glyphs.reduce((sum, glyph) => sum + estimatedGlyphAdvanceRatio(glyph) * fontSize, 0);
}

const HANGING_PUNCTUATION_RE =
	/^[\u3001\u3002\uff0c\uff0e\uff01\uff1f\uff1b\uff1a\u3009\u300b\u300d\u300f\u3011\u3015\u3017\u3019\u301b\uff09\uff3d\uff5d\u2019\u201d\u00bb\u203a]$/u;
const BREAKABLE_GLYPH_RE =
	/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}]$/u;

function estimatedWrapUnits(text: string): string[] {
	const units: string[] = [];
	let unbreakableRun = '';
	const flushRun = () => {
		if (unbreakableRun.length > 0) {
			units.push(unbreakableRun);
			unbreakableRun = '';
		}
	};

	for (const glyph of Array.from(text)) {
		if (/\s/u.test(glyph) || BREAKABLE_GLYPH_RE.test(glyph)) {
			flushRun();
			units.push(glyph);
		} else {
			unbreakableRun += glyph;
		}
	}
	flushRun();
	return units;
}

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

	if (!(maxWidth > 0) || !(fontSize > 0)) {
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
		let pendingWhitespace = false;
		for (const unit of estimatedWrapUnits(paragraph)) {
			if (/^\s+$/u.test(unit)) {
				pendingWhitespace = current.length > 0;
				continue;
			}

			const separator = pendingWhitespace && current.length > 0 ? ' ' : '';
			const candidate = `${current}${separator}${unit}`;
			if (current.length === 0 || estimatedTextWidth(Array.from(candidate), fontSize) <= maxWidth) {
				current = candidate;
				pendingWhitespace = false;
				continue;
			}
			if (HANGING_PUNCTUATION_RE.test(unit)) {
				current += unit;
				pendingWhitespace = false;
				continue;
			}

			lines.push(current);
			current = unit;
			pendingWhitespace = false;
		}
		const completed = current.trimEnd();
		if (completed.length > 0) {
			lines.push(completed);
		}
	}

	return lines;
}
