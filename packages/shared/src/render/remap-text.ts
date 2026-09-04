/**
 * Remap edited plain-text back onto original rich-text segments, preserving
 * per-segment styles (font, size, colour, bold, italic, …). Pure,
 * framework-agnostic logic shared by every binding (React / Vue / Angular).
 */
import type { TextSegment, TextStyle } from 'pptx-viewer-core';

import { isBulletMarkerSegment } from './bullet-toggle';
import { continueAutoNumberedParagraph, withoutRenderedBulletPrefix } from './remap-text-bullets';

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
 * Restore paragraph-scoped metadata on the first remapped run. Core and the
 * save writer deliberately carry these values on that run only; remapping the
 * characters must not turn an authored paragraph back into a default one.
 */
function restoreParagraphMetadata(
	from: TextSegment | undefined,
	segments: TextSegment[],
): TextSegment[] {
	if (segments.length === 0) {
		return segments;
	}
	const [first, ...rest] = segments;
	const restored = { ...first };
	// `remapParagraph` may itself return a donor segment. Clear its paragraph
	// fields first so an extra paragraph cannot accidentally inherit metadata
	// merely because it reused the final paragraph for run styling.
	delete restored.paragraphLevel;
	delete restored.paragraphProperties;
	delete restored.endParaRunProperties;
	if (from?.paragraphLevel !== undefined) {
		restored.paragraphLevel = from.paragraphLevel;
	}
	if (from?.paragraphProperties !== undefined) {
		restored.paragraphProperties = from.paragraphProperties;
	}
	if (from?.endParaRunProperties !== undefined) {
		restored.endParaRunProperties = from.endParaRunProperties;
	}
	return [restored, ...rest];
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

	// Split original segments into paragraphs by paragraph-break markers. Keep
	// each terminator because an authored empty paragraph has no content run, so
	// core carries its paragraph metadata on the terminator itself.
	const originalParagraphs: Array<{ segments: TextSegment[]; terminator?: TextSegment }> = [
		{ segments: [] },
	];
	for (const seg of originalSegments) {
		if (seg.text === '\n' || seg.isParagraphBreak) {
			originalParagraphs[originalParagraphs.length - 1].terminator = seg;
			originalParagraphs.push({ segments: [] });
		} else {
			originalParagraphs[originalParagraphs.length - 1].segments.push(seg);
		}
	}

	const newParagraphTexts = newText.split('\n');

	const firstContentSeg = originalParagraphs
		.flatMap((paragraph) => paragraph.segments)
		.find((s) => s.text.trim().length > 0);
	const baseFallbackStyle: TextStyle = firstContentSeg?.style
		? { ...firstContentSeg.style }
		: fallbackStyle;

	function remapParagraph(paraNewText: string, paraOrigSegments: TextSegment[]): TextSegment[] {
		if (paraOrigSegments.length === 0) {
			return paraNewText.length > 0
				? [{ text: paraNewText, style: { ...baseFallbackStyle } }]
				: [{ text: '', style: { ...baseFallbackStyle } }];
		}

		const firstSegment = paraOrigSegments[0];
		const dedicatedMarker =
			isBulletMarkerSegment(firstSegment) &&
			(!firstSegment.bulletInfo?.autoNumType ||
				firstSegment.bulletInfo.paragraphIndex !== undefined)
				? firstSegment
				: undefined;
		if (dedicatedMarker) {
			const contentSegments = paraOrigSegments.slice(1);
			const contentText = withoutRenderedBulletPrefix(
				paraNewText,
				paraOrigSegments,
				dedicatedMarker,
			);
			const content =
				contentSegments.length > 0
					? remapParagraph(contentText, contentSegments)
					: [{ text: contentText, style: { ...dedicatedMarker.style } }];
			return [dedicatedMarker, ...content];
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
	const lastOrigPara = originalParagraphs[originalParagraphs.length - 1]?.segments;

	for (let pi = 0; pi < newParagraphTexts.length; pi++) {
		if (pi > 0) {
			const precedingOrigPara = originalParagraphs[pi - 1]?.segments ?? [];
			const breakStyle = precedingOrigPara[0]?.style
				? { ...precedingOrigPara[0].style }
				: { ...baseFallbackStyle };
			output.push({ text: '\n', style: breakStyle, isParagraphBreak: true });
		}

		const originalParagraph = originalParagraphs[pi];
		const origPara = originalParagraph?.segments ?? lastOrigPara ?? [];
		let paraSegments = restoreParagraphMetadata(
			originalParagraph?.segments[0] ?? originalParagraph?.terminator,
			remapParagraph(newParagraphTexts[pi], origPara),
		);
		if (!originalParagraph) {
			paraSegments = continueAutoNumberedParagraph(
				paraSegments,
				lastOrigPara ?? [],
				pi - originalParagraphs.length + 1,
			);
		}
		output.push(...paraSegments);
	}

	return output.length > 0 ? output : [{ text: '', style: { ...baseFallbackStyle } }];
}
