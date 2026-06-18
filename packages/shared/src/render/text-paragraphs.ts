/**
 * Build a slide element's rich text into rendered paragraphs of styled runs,
 * enriched with bullet markers + hanging-indent layout (framework-agnostic).
 *
 * Mirrors React's `renderTextSegments` (`text-paragraph-render.tsx`): groups
 * `textSegments` into paragraphs, resolves each paragraph's bullet glyph /
 * auto-number / font / colour and its marginLeft/text-indent, and drops the
 * core-inserted bullet-marker segment from the runs (the marker is rendered
 * separately so it can pick up bullet font/size/colour). Each binding maps the
 * returned plain-object styles onto its own style binding.
 */

import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { resolveParagraphBullet, resolveParagraphIndent } from './bullet-list';

/** A plain CSS style map (keys are CSS properties; binding-agnostic). */
export type RunStyle = Record<string, string | number>;

/** A single rendered run within a paragraph. */
export interface ParagraphRun {
	text: string;
	style: RunStyle;
}

/** A rendered paragraph: runs plus resolved bullet + hanging-indent metadata. */
export interface RenderParagraph {
	runs: ParagraphRun[];
	/** Bullet glyph / number to render before the runs (or `undefined`). */
	bulletMarker?: string;
	/** Inline style for the bullet marker (font / size / colour). */
	bulletStyle: RunStyle;
	/** `margin-left` in px for the whole paragraph (hanging-indent layout). */
	marginLeftPx?: number;
	/** `text-indent` in px (first-line / hanging indent). */
	textIndentPx?: number;
}

/** Per-run inline style derived from a TextSegment's style. */
export function segmentStyleToCss(seg: TextSegment): RunStyle {
	const s = seg.style ?? {};
	const style: RunStyle = {};
	if (s.fontFamily) {
		style.fontFamily = s.fontFamily;
	}
	// px, not pt — the parsed value is the CSS px size (matches React + the inline
	// editor). Appending `pt` inflates every run by ~1.33×.
	if (typeof s.fontSize === 'number') {
		style.fontSize = `${s.fontSize}px`;
	}
	if (s.color) {
		style.color = s.color;
	}
	if (s.bold) {
		style.fontWeight = 'bold';
	}
	if (s.italic) {
		style.fontStyle = 'italic';
	}
	const deco: string[] = [];
	if (s.underline) {
		deco.push('underline');
	}
	if (s.strikethrough) {
		deco.push('line-through');
	}
	if (deco.length > 0) {
		style.textDecoration = deco.join(' ');
	}
	return style;
}

/**
 * Group `element`'s text segments into rendered paragraphs. Paragraph
 * separators are `isParagraphBreak` segments (post-edit remap) or bare `"\n"`
 * text segments (the slide-load path); soft line breaks insert a newline within
 * a paragraph. Bullets are suppressed for paragraphs with no visible text.
 */
export function buildParagraphs(element: PptxElement): RenderParagraph[] {
	if (!hasTextProperties(element)) {
		return [];
	}
	const segments = element.textSegments;
	if (!segments || segments.length === 0) {
		return element.text ? [{ runs: [{ text: element.text, style: {} }], bulletStyle: {} }] : [];
	}

	const paragraphIndents = element.paragraphIndents;
	const grouped: Array<{ paraSegments: TextSegment[] }> = [{ paraSegments: [] }];
	for (const seg of segments) {
		if (seg.isParagraphBreak || (seg.text === '\n' && !seg.isLineBreak)) {
			grouped.push({ paraSegments: [] });
			continue;
		}
		grouped[grouped.length - 1].paraSegments.push(seg);
	}

	const result: RenderParagraph[] = grouped.map(({ paraSegments }, paraIndex) => {
		const firstSeg = paraSegments[0];
		const bulletResult = resolveParagraphBullet(firstSeg);

		// The slide-load path inserts a *dedicated* marker segment whose text is the
		// precomputed glyph/number; we render the marker ourselves, so drop that
		// segment from the runs to avoid a doubled marker. A run that merely carries
		// `bulletInfo` but holds real content text (edit-remap path) is kept.
		const markerSegment =
			bulletResult && firstSeg?.bulletInfo && firstSeg.text.trim() === bulletResult.marker.trim()
				? firstSeg
				: undefined;

		const runs: ParagraphRun[] = [];
		for (const seg of paraSegments) {
			if (seg === markerSegment) {
				continue;
			}
			const text = seg.isLineBreak ? '\n' : seg.text;
			if (text) {
				runs.push({ text, style: segmentStyleToCss(seg) });
			}
		}

		// Suppress bullets for paragraphs with no visible text content.
		const hasVisibleTextContent = paraSegments.some(
			(seg) => seg !== markerSegment && Boolean(seg.text) && seg.text.trim().length > 0,
		);
		const bullet = hasVisibleTextContent ? bulletResult : undefined;

		const bulletStyle: RunStyle = {};
		if (bullet) {
			if (bullet.color) {
				bulletStyle.color = bullet.color;
			}
			if (bullet.fontFamily) {
				bulletStyle.fontFamily = bullet.fontFamily;
			}
			const runFontSize = firstSeg?.style?.fontSize;
			if (typeof bullet.sizePts === 'number') {
				bulletStyle.fontSize = `${bullet.sizePts}px`;
			} else if (typeof bullet.sizePercent === 'number' && typeof runFontSize === 'number') {
				bulletStyle.fontSize = `${runFontSize * (bullet.sizePercent / 100)}px`;
			}
		}

		const indent = resolveParagraphIndent(paragraphIndents?.[paraIndex], firstSeg?.paragraphLevel);
		return {
			runs,
			bulletMarker: bullet?.marker,
			bulletStyle,
			marginLeftPx: indent.marginLeftPx,
			textIndentPx: indent.textIndentPx,
		};
	});

	return result.filter(
		(p) => p.runs.length > 0 || p.bulletMarker !== undefined || result.length === 1,
	);
}
