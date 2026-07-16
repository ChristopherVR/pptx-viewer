/**
 * Pure paragraph bullet / list-marker + indent helpers (framework-agnostic).
 *
 * Mirrors React's paragraph + bullet renderer (`text-paragraph-render.tsx` +
 * `text-segment-render.tsx`): bullet-glyph selection, auto-numbering (see
 * {@link ./bullet-autonum}), bullet font/size/colour, and the marginLeft /
 * hanging-indent layout. Shared by the React/Vue/Angular bindings.
 */

import type { BulletInfo, TextSegment } from 'pptx-viewer-core';

import { formatAutoNumber } from './bullet-autonum';

/**
 * Resolved bullet marker for a single paragraph. `marker` is the text to
 * prepend (e.g. "•", "1.", "a)"); `isNumbered` is true for auto-numbered lists.
 * `color`/`fontFamily`/`sizePts`/`sizePercent` carry optional explicit overrides
 * (the latter as a percentage of the run font size).
 */
export interface ParagraphBulletResult {
	marker: string;
	isNumbered: boolean;
	color?: string;
	fontFamily?: string;
	sizePts?: number;
	sizePercent?: number;
	picture?: PictureBulletMarker;
}

/** Framework-neutral picture-bullet source, sizing, and accessible fallback. */
export interface PictureBulletMarker {
	src?: string;
	sizePx: number;
	fallbackMarker: string;
	accessibleLabel: string;
	imageRelId?: string;
}

/** Resolve React-compatible picture-bullet sizing and fallback metadata. */
export function resolvePictureBullet(
	info: BulletInfo,
	baseFontSize: number,
): PictureBulletMarker | undefined {
	if (!info.imageDataUrl && !info.imageRelId && !info.imageBlipFillXml) {
		return undefined;
	}
	const sizePx =
		typeof info.sizePts === 'number'
			? info.sizePts
			: typeof info.sizePercent === 'number'
				? baseFontSize * (info.sizePercent / 100)
				: baseFontSize;
	return {
		...(info.imageDataUrl ? { src: info.imageDataUrl } : {}),
		sizePx,
		fallbackMarker: '•',
		accessibleLabel: 'Bullet',
		...(info.imageRelId ? { imageRelId: info.imageRelId } : {}),
	};
}

/**
 * Resolve the bullet marker for the first segment of a paragraph.
 *
 * Returns `undefined` when the segment is absent or carries no `bulletInfo`,
 * when `bulletInfo.none`/`listType:'none'` suppresses it, or when neither a
 * character bullet nor an auto-number type is present. For auto-numbered
 * bullets the 1-based sequence index is `autoNumStartAt` (default 1) plus the
 * 0-based `paragraphIndex`.
 */
export function resolveParagraphBullet(
	firstSegment: TextSegment | undefined,
	baseFontSize: number = firstSegment?.style?.fontSize ?? 16,
): ParagraphBulletResult | undefined {
	if (!firstSegment) {
		return undefined;
	}
	// listType on the first segment's style can explicitly suppress bullets.
	if (firstSegment.style?.listType === 'none') {
		return undefined;
	}
	const info: BulletInfo | undefined = firstSegment.bulletInfo;
	if (!info || info.none) {
		return undefined;
	}

	const color = info.color;
	const fontFamily = info.fontFamily;
	const sizePts = typeof info.sizePts === 'number' ? info.sizePts : undefined;
	const sizePercent = typeof info.sizePercent === 'number' ? info.sizePercent : undefined;
	const picture = resolvePictureBullet(info, baseFontSize);
	if (picture) {
		return {
			marker: picture.fallbackMarker,
			isNumbered: false,
			color,
			fontFamily,
			sizePts,
			sizePercent,
			picture,
		};
	}

	// ── Auto-numbered list ──
	if (info.autoNumType) {
		const startAt = typeof info.autoNumStartAt === 'number' ? info.autoNumStartAt : 1;
		const paraIdx = typeof info.paragraphIndex === 'number' ? info.paragraphIndex : 0;
		const seqNum = Math.max(1, startAt + paraIdx);
		return {
			marker: formatAutoNumber(info.autoNumType, seqNum),
			isNumbered: true,
			color,
			fontFamily,
			sizePts,
			sizePercent,
		};
	}

	// ── Character bullet ──
	if (info.char) {
		return { marker: info.char, isNumbered: false, color, fontFamily, sizePts, sizePercent };
	}

	// Unsupported cases have no marker to show as text.
	return undefined;
}

/** Pixels of left-padding to apply per list nesting level. */
const INDENT_PX_PER_LEVEL = 18;

/**
 * Return the left-indent in pixels for the given 0-based list nesting level
 * (OOXML `a:p/@lvl`). `undefined`/negative is treated as level 0. Used as a
 * fallback when the element carries no explicit per-paragraph `marginLeft`.
 */
export function bulletIndentPx(level: number | undefined): number {
	const lvl = typeof level === 'number' && level > 0 ? level : 0;
	return lvl * INDENT_PX_PER_LEVEL;
}

/** Per-paragraph indent metadata from `PptxTextProperties.paragraphIndents`. */
export interface ParagraphIndent {
	marginLeft?: number;
	indent?: number;
}

/** Resolved CSS hanging-indent layout for a paragraph (px). */
export interface ParagraphIndentLayout {
	/** `margin-left` in px (whole-paragraph indent), or `undefined` for none. */
	marginLeftPx?: number;
	/** `text-indent` in px (first-line / hanging indent), or `undefined`. */
	textIndentPx?: number;
}

/**
 * Resolve the hanging-indent layout for a paragraph (mirrors React's
 * `text-paragraph-render.tsx`). Explicit `paragraphIndents[paraIndex]`
 * `marginLeft`/`indent` are used verbatim (zeros omitted); otherwise falls back
 * to the per-level indent derived from `paragraphLevel`.
 */
export function resolveParagraphIndent(
	paraIndent: ParagraphIndent | undefined,
	paragraphLevel: number | undefined,
): ParagraphIndentLayout {
	const marginLeft =
		typeof paraIndent?.marginLeft === 'number' && paraIndent.marginLeft !== 0
			? paraIndent.marginLeft
			: undefined;
	const textIndent =
		typeof paraIndent?.indent === 'number' && paraIndent.indent !== 0
			? paraIndent.indent
			: undefined;

	if (marginLeft === undefined && textIndent === undefined) {
		const levelPx = bulletIndentPx(paragraphLevel);
		return levelPx > 0 ? { marginLeftPx: levelPx } : {};
	}
	return { marginLeftPx: marginLeft, textIndentPx: textIndent };
}
