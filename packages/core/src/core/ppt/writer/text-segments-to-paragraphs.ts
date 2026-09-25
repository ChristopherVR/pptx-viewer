/**
 * `PptxElement.textSegments` (a flat run list with paragraph-break markers)
 * -> `WParagraph[]` for the `.ppt` writer.
 *
 * @module ppt/writer/text-segments-to-paragraphs
 */

import { EMU_PER_PX } from '../../constants';
import type { PptxAction } from '../../types/actions';
import type { TextSegment, TextStyle } from '../../types/text';
import { isRenderedBulletMarker } from '../../utils/rendered-bullet-marker';
import type { HyperlinkResolveContext } from './hyperlink-model';
import { resolveHyperlink } from './hyperlink-model';
import type { WParagraph, WRun } from './write-model';

const ALIGN_MAP: Record<string, WParagraph['align']> = {
	left: 'l',
	center: 'ctr',
	right: 'r',
	justify: 'just',
	justLow: 'just',
	dist: 'just',
	thaiDist: 'just',
};

/** PowerPoint's own binary-text soft-line-break encoding: a vertical tab. */
const SOFT_BREAK_CHAR = String.fromCharCode(0x0b);

/** Build a `PptxAction`-shaped object from a run's own `TextStyle` hyperlink fields. */
function segmentHyperlinkAction(segment: TextSegment): PptxAction | undefined {
	const style = segment.style;
	if (!style?.hyperlink && !style?.hyperlinkAction) {
		return undefined;
	}
	return {
		url: style.hyperlink,
		action: style.hyperlinkAction,
		targetSlideIndex: style.hyperlinkTargetSlideIndex,
		tooltip: style.hyperlinkTooltip,
	};
}

function styleToRun(
	text: string,
	style: TextStyle | undefined,
	segment: TextSegment | undefined,
	hyperlinkCtx: HyperlinkResolveContext,
): WRun {
	return {
		text,
		bold: style?.bold,
		italic: style?.italic,
		underline: style?.underline,
		// `TextStyle.fontSize` is CSS px (the `.pptx` save writes `sz` as px * 72 / 96);
		// a TextCFException's size is in points.
		sizePt: style?.fontSize !== undefined ? (style.fontSize * 72) / 96 : undefined,
		colorRgb: style?.color?.replace(/^#/u, ''),
		fontName: style?.fontFamily,
		hyperlink: segment
			? resolveHyperlink(segmentHyperlinkAction(segment), hyperlinkCtx)
			: undefined,
	};
}

interface ParagraphMeta {
	level: number;
	align: WParagraph['align'];
	marginLeftEmu?: number;
	indentEmu?: number;
	hasBullet?: boolean;
	bulletChar?: string;
	bulletColorRgb?: string;
}

function metaFromSegment(
	segment: TextSegment,
	paragraphIndents: Array<{ marginLeft?: number; indent?: number }> | undefined,
	paraIndex: number,
	fallbackAlign: WParagraph['align'],
): ParagraphMeta {
	const bullet = segment.bulletInfo;
	const alignToken = segment.paragraphProperties?.align;
	const indents = paragraphIndents?.[paraIndex];
	return {
		level: segment.paragraphLevel ?? 0,
		align: (alignToken && ALIGN_MAP[alignToken]) ?? fallbackAlign,
		marginLeftEmu: indents?.marginLeft !== undefined ? indents.marginLeft * EMU_PER_PX : undefined,
		indentEmu: indents?.indent !== undefined ? indents.indent * EMU_PER_PX : undefined,
		hasBullet: bullet ? !bullet.none : undefined,
		bulletChar: bullet?.char,
		bulletColorRgb: bullet?.color?.replace(/^#/u, ''),
	};
}

/**
 * Convert a flat `textSegments` run list into paragraphs, splitting on
 * `isParagraphBreak` segments and mapping `isLineBreak` segments to a
 * vertical-tab (0x0B) character, PowerPoint's own binary-text soft-break
 * encoding.
 */
export function textSegmentsToParagraphs(
	segments: TextSegment[],
	paragraphIndents: Array<{ marginLeft?: number; indent?: number }> | undefined,
	fallback: { text?: string; style?: TextStyle; hyperlinkCtx: HyperlinkResolveContext },
): WParagraph[] {
	const hyperlinkCtx = fallback.hyperlinkCtx;
	if (segments.length === 0) {
		if (!fallback.text) {
			return [];
		}
		return [
			{
				indentLevel: 0,
				align: 'l',
				runs: [styleToRun(fallback.text, fallback.style, undefined, hyperlinkCtx)],
			},
		];
	}

	const fallbackAlign = (fallback.style?.align && ALIGN_MAP[fallback.style.align]) ?? 'l';
	const paragraphs: WParagraph[] = [];
	let runs: WRun[] = [];
	let meta: ParagraphMeta | undefined;
	let paraIndex = 0;

	const flush = (): void => {
		const m = meta ?? { level: 0, align: fallbackAlign };
		paragraphs.push({
			indentLevel: m.level,
			align: m.align,
			hasBullet: m.hasBullet,
			bulletChar: m.bulletChar,
			bulletColorRgb: m.bulletColorRgb,
			marginLeftEmu: m.marginLeftEmu,
			indentEmu: m.indentEmu,
			runs,
		});
		runs = [];
		meta = undefined;
		paraIndex++;
	};

	for (const segment of segments) {
		if (segment.isParagraphBreak) {
			flush();
			continue;
		}
		if (meta === undefined) {
			meta = metaFromSegment(segment, paragraphIndents, paraIndex, fallbackAlign);
		}
		// The parser's display-only bullet marker ("• ") is paragraph metadata
		// (`hasBullet`/`bulletChar` above), not text; writing it doubled the bullet.
		if (isRenderedBulletMarker(segment)) {
			continue;
		}
		if (segment.isLineBreak) {
			runs.push(styleToRun(SOFT_BREAK_CHAR, segment.style, segment, hyperlinkCtx));
			continue;
		}
		// A parsed deck marks each paragraph boundary with a literal "\n" run
		// (the `.pptx` save splits on it too); only the SDK sets `isParagraphBreak`.
		const parts = segment.text.split('\n');
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i]!;
			if (part.length > 0) {
				runs.push(styleToRun(part, segment.style, segment, hyperlinkCtx));
			}
			if (i < parts.length - 1) {
				flush();
			}
		}
	}
	if (runs.length > 0 || meta !== undefined || paragraphs.length === 0) {
		flush();
	}

	return paragraphs;
}
