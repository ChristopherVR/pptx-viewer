/**
 * `PptxElement.textSegments` (a flat run list with paragraph-break markers)
 * -> `WParagraph[]` for the `.ppt` writer.
 *
 * @module ppt/writer/text-segments-to-paragraphs
 */

import { EMU_PER_PX } from '../../constants';
import type { TextSegment, TextStyle } from '../../types/text';
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

function styleToRun(text: string, style: TextStyle | undefined): WRun {
	return {
		text,
		bold: style?.bold,
		italic: style?.italic,
		underline: style?.underline,
		sizePt: style?.fontSize,
		colorRgb: style?.color?.replace(/^#/u, ''),
		fontName: style?.fontFamily,
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
	fallback: { text?: string; style?: TextStyle },
): WParagraph[] {
	if (segments.length === 0) {
		if (!fallback.text) {
			return [];
		}
		return [{ indentLevel: 0, align: 'l', runs: [styleToRun(fallback.text, fallback.style)] }];
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
		const text = segment.isLineBreak ? SOFT_BREAK_CHAR : segment.text;
		runs.push(styleToRun(text, segment.style));
	}
	flush();

	return paragraphs;
}
