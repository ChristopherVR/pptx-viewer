import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle, BulletInfo } from 'pptx-viewer-core';
import {
	resolveCssTextAlign,
	resolveParagraphAlign,
	resolveParagraphRtl,
	resolveParagraphStrutFontSize,
} from 'pptx-viewer-shared';
import React from 'react';

import type { ElementAnimationState } from './animation-timeline';
import { getKinsokuLineBreakStyles } from './kinsoku-styles';
import { wrapWithTextBuildAnimation } from './text-animation';
import type { ParagraphEntry } from './text-animation';
import type { FieldSubstitutionContext } from './text-field-substitution';
import { resolveParagraphSpacing } from './text-paragraph-spacing';
import type { ElementFindHighlights } from './text-segment-helpers';
import { renderSingleSegment } from './text-segment-render';

// Per-paragraph BiDi direction + text-alignment resolution now lives in
// pptx-viewer-shared (render/text-paragraph-style). Re-exported here so existing
// React import paths keep working.
export { resolveCssTextAlign, resolveParagraphAlign, resolveParagraphRtl };

function groupSegmentsIntoParagraphs(
	segments: ReadonlyArray<{
		text: string;
		style: TextStyle;
		bulletInfo?: BulletInfo;
		fieldType?: string;
		equationXml?: Record<string, unknown>;
		equationNumber?: string;
		rubyText?: string;
		rubyAlignment?: string;
		rubyFontSize?: number;
		rubyStyle?: TextStyle;
	}>,
): Array<Array<ParagraphEntry>> {
	const paragraphs: Array<Array<ParagraphEntry>> = [];
	let current: Array<ParagraphEntry> = [];

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		if (seg.text === '\n') {
			paragraphs.push(current);
			current = [];
		} else {
			current.push({ segment: seg, globalIndex: i });
		}
	}
	if (current.length > 0 || paragraphs.length === 0) {
		paragraphs.push(current);
	}

	return paragraphs;
}

export function renderTextSegments(
	element: PptxElement,
	fallbackColor: string,
	emptyFallback?: string,
	findHighlights?: ElementFindHighlights,
	onHyperlinkClick?: (url: string) => void,
	fieldContext?: FieldSubstitutionContext,
	/** Per-sub-element animation states for text build animations. */
	subElementAnimStates?: ReadonlyMap<string, ElementAnimationState>,
	/** When provided, these segments replace element.textSegments for rendering (used by linked text box overflow). */
	segmentOverrides?: ReadonlyArray<{
		text: string;
		style: TextStyle;
		bulletInfo?: BulletInfo;
		fieldType?: string;
		equationXml?: Record<string, unknown>;
		equationNumber?: string;
		isParagraphBreak?: boolean;
		rubyText?: string;
		rubyAlignment?: string;
		rubyFontSize?: number;
		rubyStyle?: TextStyle;
		/** Per-paragraph geometry authored on the first segment of a paragraph. */
		paragraphProperties?: TextStyle;
	}>,
	/** When true, hyperlinks require Ctrl+Click (editing mode). */
	requireCtrlClick?: boolean,
): React.ReactNode {
	if (!hasTextProperties(element)) {
		return emptyFallback || null;
	}

	const effectiveSegments = segmentOverrides ?? element.textSegments;

	if (!effectiveSegments || effectiveSegments.length === 0) {
		if (!element.text && element.promptText) {
			return (
				<span
					style={{
						opacity: 0.5,
						color: '#888888',
						pointerEvents: 'none',
					}}
				>
					{element.promptText}
				</span>
			);
		}
		return element.text || emptyFallback || '';
	}

	const paragraphs = groupSegmentsIntoParagraphs(effectiveSegments);
	const paragraphIndents = hasTextProperties(element) ? element.paragraphIndents : undefined;
	const elementRtl = hasTextProperties(element) ? element.textStyle?.rtl : undefined;

	const elementAlign = hasTextProperties(element) ? element.textStyle?.align : undefined;
	const bodyStyle = hasTextProperties(element) ? element.textStyle : undefined;
	// `spcFirstLastPara`: only suppress first/last edge spacing when explicitly
	// disabled; default to applying it so single-level text keeps its spacing.
	const spaceFirstLast = bodyStyle?.spaceFirstLastParagraph !== false;

	return paragraphs.map((paraSegments, paraIndex) => {
		const paraIndent = paragraphIndents?.[paraIndex];
		const rawMarginLeft =
			typeof paraIndent?.marginLeft === 'number' && paraIndent.marginLeft !== 0
				? paraIndent.marginLeft
				: undefined;
		const rawTextIndent =
			typeof paraIndent?.indent === 'number' && paraIndent.indent !== 0
				? paraIndent.indent
				: undefined;

		const firstSeg = paraSegments[0];
		const bulletInfo = firstSeg?.segment.bulletInfo;
		// Suppress bullets for paragraphs with no visible text content.
		// In PowerPoint, empty bullet paragraphs (e.g. residual first paragraphs
		// or line breaks with no text) don't render a bullet character.
		const hasVisibleTextContent = paraSegments.some(({ segment }) => {
			// Skip the bullet segment itself: it only contains the marker text
			if (segment.bulletInfo) {
				return false;
			}
			return Boolean(segment.text) && segment.text.trim().length > 0;
		});
		const hasBullet = bulletInfo && !bulletInfo.none && hasVisibleTextContent;
		const paraRtl = resolveParagraphRtl(paraSegments, elementRtl);
		const isRtlParagraph = paraRtl === true;

		// Resolve explicit paragraph alignment from segment styles
		const paraAlign = resolveParagraphAlign(paraSegments, elementAlign);
		const cssTextAlign = resolveCssTextAlign(paraAlign, isRtlParagraph);

		// For RTL paragraphs, swap marginLeft/textIndent to marginRight
		// so bullets and indentation appear on the correct (right) side.
		const paraMarginLeft = isRtlParagraph ? undefined : rawMarginLeft;
		const paraMarginRight = isRtlParagraph ? rawMarginLeft : undefined;
		const paraTextIndent = rawTextIndent;

		// Per-paragraph kinsoku line-breaking styles from the first segment's style.
		// Paragraph-level properties (eaLineBreak, hangingPunctuation, latinLineBreak)
		// are stored on the TextStyle of paragraph segments.
		const paraKinsokuStyle = getKinsokuLineBreakStyles(firstSeg?.segment.style);
		const hasParaKinsoku = Object.keys(paraKinsokuStyle).length > 0;

		// Per-paragraph line spacing (a:lnSpc) and space before/after
		// (a:spcBef / a:spcAft), sourced from this paragraph's own geometry with
		// a body-level fallback for inherited/single-level text.
		const paraProps = effectiveSegments[firstSeg?.globalIndex ?? -1]?.paragraphProperties;
		const spacing = resolveParagraphSpacing({
			paraProps,
			bodyStyle,
			isFirst: paraIndex === 0,
			isLast: paraIndex === paragraphs.length - 1,
			spaceFirstLast,
		});
		// Re-base this paragraph's line box on its own runs. Without it the
		// block strut stays at the body's default size and a paragraph of
		// smaller runs is laid out on too-tall lines (see
		// `resolveParagraphStrutFontSize`). Every run span carries an explicit
		// font-size, so this only moves the strut.
		const strutFontSize = resolveParagraphStrutFontSize(
			paraSegments.map(({ segment }) => segment),
			bodyStyle?.fontSize,
		);

		const hasParaSpacing =
			spacing.marginTop !== undefined ||
			spacing.marginBottom !== undefined ||
			spacing.lineHeight !== undefined;

		const paraStyle: React.CSSProperties = {
			...paraKinsokuStyle,
		};
		if (strutFontSize !== undefined) {
			paraStyle.fontSize = strutFontSize;
		}
		if (spacing.marginTop !== undefined) {
			paraStyle.marginTop = spacing.marginTop;
		}
		if (spacing.marginBottom !== undefined) {
			paraStyle.marginBottom = spacing.marginBottom;
		}
		if (spacing.lineHeight !== undefined) {
			paraStyle.lineHeight = spacing.lineHeight;
		}
		if (paraMarginLeft !== undefined) {
			paraStyle.marginLeft = paraMarginLeft;
		}
		if (paraMarginRight !== undefined) {
			paraStyle.marginRight = paraMarginRight;
		}
		if (paraTextIndent !== undefined) {
			paraStyle.textIndent = paraTextIndent;
		}
		if (paraRtl !== undefined) {
			paraStyle.direction = paraRtl ? 'rtl' : 'ltr';
			// Use 'embed' so the paragraph establishes a BiDi embedding level.
			// This ensures numbers within RTL text render LTR naturally per the
			// Unicode Bidi Algorithm, while 'plaintext' is used as a fallback
			// only at the element/body level.
			paraStyle.unicodeBidi = 'embed';
		}
		if (cssTextAlign !== undefined) {
			paraStyle.textAlign = cssTextAlign;
		}

		const needsWrapper =
			paraMarginLeft !== undefined ||
			paraMarginRight !== undefined ||
			paraTextIndent !== undefined ||
			hasBullet ||
			paraRtl !== undefined ||
			cssTextAlign !== undefined ||
			hasParaKinsoku ||
			hasParaSpacing ||
			strutFontSize !== undefined;

		const renderedSegments = paraSegments
			.filter(({ segment }) => {
				// Skip bullet segments when the bullet should be suppressed
				if (!hasBullet && segment.bulletInfo) {
					return false;
				}
				return true;
			})
			.map(({ segment, globalIndex }) =>
				renderSingleSegment(
					element,
					segment,
					globalIndex,
					fallbackColor,
					findHighlights,
					hasBullet && globalIndex === firstSeg.globalIndex ? bulletInfo : undefined,
					onHyperlinkClick,
					fieldContext,
					paraRtl,
					requireCtrlClick,
				),
			);

		const wrappedContent = wrapWithTextBuildAnimation(
			element.id,
			paraIndex,
			renderedSegments,
			paraSegments,
			subElementAnimStates,
			// A staged build splits the paragraph but must not flatten it: each
			// piece is re-rendered through the SAME segment renderer, so it keeps
			// its run's font, size, colour and decoration while it animates.
			({ segment, globalIndex }, text) =>
				renderSingleSegment(
					element,
					{ ...segment, text },
					globalIndex,
					fallbackColor,
					findHighlights,
					undefined,
					onHyperlinkClick,
					fieldContext,
					paraRtl,
					requireCtrlClick,
				),
		);

		if (!needsWrapper) {
			return (
				<React.Fragment key={`${element.id}-para-${paraIndex}`}>
					{wrappedContent}
					{paraIndex < paragraphs.length - 1 ? <br /> : null}
				</React.Fragment>
			);
		}

		return (
			<div key={`${element.id}-para-${paraIndex}`} style={paraStyle}>
				{wrappedContent}
			</div>
		);
	});
}
