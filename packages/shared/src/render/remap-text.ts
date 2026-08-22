/**
 * Remap edited plain-text back onto original rich-text segments, preserving
 * per-segment styles (font, size, colour, bold, italic, …). Pure,
 * framework-agnostic logic shared by every binding (React / Vue / Angular).
 */
import type { TextSegment, TextStyle } from 'pptx-viewer-core';

/**
 * Whether an original segment is ATOMIC: its rendered text is not what is
 * literally stored (a field re-substitutes its live value at render, from
 * `text-field-substitution.ts`'s `substituteFieldText`; an equation's `text`
 * is a placeholder like `"[Equation]"`, the maths lives in `equationXml`).
 *
 * An atomic segment must never absorb typed text beyond its own original
 * length, even when it is the paragraph's LAST segment (see the loop in
 * {@link remapTextToSegments}'s `remapParagraph`): the ordinary "last segment
 * gets everything left over" rule would merge whatever the user typed
 * immediately after the field/equation into it, and `copySegmentMetadata`
 * would carry the `fieldType`/`equationXml` onto that merged text, so the
 * user's own literal characters vanish the next time the field re-renders or
 * the equation re-serialises - silently, with no error and no visible
 * difference until then. A common, unremarkable edit ("Page " + a slide-
 * number field + typing " of 10" right after it) triggers this every time.
 */
function isAtomicOriginalSegment(seg: TextSegment): boolean {
	return seg.fieldType !== undefined || seg.equationXml !== undefined;
}

/**
 * Copy segment-level metadata (equation, field) from an original segment onto
 * its remapped counterpart. Without this, entering and leaving inline text
 * editing destroys the data these fields carry even when nothing was typed:
 * an equation collapses to its literal "[Equation]" placeholder text and a
 * slide-number/date field degrades to frozen plain text. Hyperlink and other
 * style-level properties already survive via the copied `style` object.
 */
function copySegmentMetadata(from: TextSegment, to: TextSegment): TextSegment {
	if (from.equationXml !== undefined) {
		to.equationXml = from.equationXml;
	}
	if (from.equationNumber !== undefined) {
		to.equationNumber = from.equationNumber;
	}
	if (from.fieldType !== undefined) {
		to.fieldType = from.fieldType;
	}
	if (from.fieldGuid !== undefined) {
		to.fieldGuid = from.fieldGuid;
	}
	if (from.fieldGuidAttr !== undefined) {
		to.fieldGuidAttr = from.fieldGuidAttr;
	}
	if (from.fieldParagraphPropertiesXml !== undefined) {
		to.fieldParagraphPropertiesXml = from.fieldParagraphPropertiesXml;
	}
	return to;
}

/**
 * Strategy:
 * 1. Split both original segments and new text into paragraphs by "\n".
 * 2. Distribute new characters proportionally across segments.
 * 3. Extra chars go to last segment, extra paragraphs inherit last style.
 * 4. Re-insert paragraph-break markers between paragraphs.
 */
export function remapTextToSegments(
	newText: string,
	originalSegments: TextSegment[] | undefined,
	elementTextStyle: TextStyle | undefined,
): TextSegment[] {
	const fallbackStyle: TextStyle = { ...elementTextStyle };

	if (!originalSegments || originalSegments.length === 0) {
		return [{ text: newText, style: fallbackStyle }];
	}

	// Split original segments into paragraphs by paragraph-break markers.
	const originalParagraphs: TextSegment[][] = [[]];
	for (const seg of originalSegments) {
		if (seg.text === '\n' || seg.isParagraphBreak) {
			originalParagraphs.push([]);
		} else {
			originalParagraphs[originalParagraphs.length - 1].push(seg);
		}
	}

	const newParagraphTexts = newText.split('\n');

	const firstContentSeg = originalParagraphs.flat().find((s) => s.text.trim().length > 0);
	const baseFallbackStyle: TextStyle = firstContentSeg?.style
		? { ...firstContentSeg.style }
		: fallbackStyle;

	function remapParagraph(paraNewText: string, paraOrigSegments: TextSegment[]): TextSegment[] {
		if (paraOrigSegments.length === 0) {
			return paraNewText.length > 0
				? [{ text: paraNewText, style: { ...baseFallbackStyle } }]
				: [{ text: '', style: { ...baseFallbackStyle } }];
		}

		const paragraphBulletInfo = paraOrigSegments[0].bulletInfo;

		if (paraNewText.length === 0) {
			const emptyStyle = { ...paraOrigSegments[0].style };
			const result: TextSegment[] = [{ text: '', style: emptyStyle }];
			if (paragraphBulletInfo) {
				result[0].bulletInfo = paragraphBulletInfo;
			}
			return result;
		}

		const totalOrigLen = paraOrigSegments.reduce((sum, s) => sum + s.text.length, 0);

		if (totalOrigLen === 0) {
			const result: TextSegment[] = [
				copySegmentMetadata(paraOrigSegments[0], {
					text: paraNewText,
					style: { ...paraOrigSegments[0].style },
				}),
			];
			if (paragraphBulletInfo) {
				result[0].bulletInfo = paragraphBulletInfo;
			}
			return result;
		}

		const remapped: TextSegment[] = [];
		let newPos = 0;

		for (let i = 0; i < paraOrigSegments.length; i++) {
			const origSeg = paraOrigSegments[i];
			// An atomic (field/equation) segment never gets the "last segment
			// absorbs everything left over" treatment, even when it IS the last
			// segment - see `isAtomicOriginalSegment`.
			const isLastSeg = i === paraOrigSegments.length - 1 && !isAtomicOriginalSegment(origSeg);
			const origLen = origSeg.text.length;

			if (newPos >= paraNewText.length) {
				break;
			}

			let segText: string;
			if (isLastSeg) {
				segText = paraNewText.slice(newPos);
			} else {
				segText = paraNewText.slice(newPos, newPos + origLen);
			}

			if (segText.length > 0) {
				const outSeg: TextSegment = copySegmentMetadata(origSeg, {
					text: segText,
					style: { ...origSeg.style },
				});
				if (remapped.length === 0 && paragraphBulletInfo) {
					outSeg.bulletInfo = paragraphBulletInfo;
				}
				remapped.push(outSeg);
			}

			newPos += isLastSeg ? segText.length : origLen;
		}

		// Typed text that runs past the last (capped, atomic) field/equation
		// segment becomes its own new, PLAIN trailing segment - carrying none of
		// that segment's metadata - so it survives instead of being silently
		// discarded. Ordinary (non-atomic) paragraphs never reach here: their
		// true last segment already absorbed everything via `isLastSeg` above.
		if (newPos < paraNewText.length) {
			const lastOrigSeg = paraOrigSegments[paraOrigSegments.length - 1];
			remapped.push({
				text: paraNewText.slice(newPos),
				style: { ...lastOrigSeg.style },
			});
		}

		if (remapped.length === 0) {
			const fallback: TextSegment = copySegmentMetadata(paraOrigSegments[0], {
				text: paraNewText,
				style: { ...paraOrigSegments[0].style },
			});
			if (paragraphBulletInfo) {
				fallback.bulletInfo = paragraphBulletInfo;
			}
			return [fallback];
		}

		return remapped;
	}

	const output: TextSegment[] = [];
	const lastOrigPara = originalParagraphs[originalParagraphs.length - 1];

	for (let pi = 0; pi < newParagraphTexts.length; pi++) {
		if (pi > 0) {
			const precedingOrigPara = originalParagraphs[pi - 1] ?? [];
			const breakStyle = precedingOrigPara[0]?.style
				? { ...precedingOrigPara[0].style }
				: { ...baseFallbackStyle };
			output.push({ text: '\n', style: breakStyle, isParagraphBreak: true });
		}

		const origPara = originalParagraphs[pi] ?? lastOrigPara ?? [];
		const paraSegments = remapParagraph(newParagraphTexts[pi], origPara);
		output.push(...paraSegments);
	}

	return output.length > 0 ? output : [{ text: '', style: { ...baseFallbackStyle } }];
}
