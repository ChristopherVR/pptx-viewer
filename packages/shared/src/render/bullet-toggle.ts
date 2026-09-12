/**
 * List commands author first-segment bulletInfo, which render and save consume.
 * Bindings apply these patches through their existing update/history operations.
 */
import type { BulletInfo, PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import {
	breakAutoNumberRun,
	createAutoNumberSequence,
	hasTextProperties,
	nextAutoNumber,
} from 'pptx-viewer-core';

import { formatAutoNumber } from './bullet-autonum';
import { resolveParagraphBullet } from './bullet-list';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

export type ParagraphBulletKind = 'bullet' | 'numbered' | 'none';
export const DEFAULT_BULLET_CHAR = '•';
export const DEFAULT_AUTONUM_TYPE = 'arabicPeriod';

export function bulletInfoForKind(kind: ParagraphBulletKind, ordinal = 0): BulletInfo {
	if (kind === 'none') {
		return { none: true };
	}
	if (kind === 'bullet') {
		return { char: DEFAULT_BULLET_CHAR };
	}
	return { autoNumType: DEFAULT_AUTONUM_TYPE, autoNumStartAt: 1, paragraphIndex: ordinal };
}

/** Matches core's synthetic prefix, including picture and suppressed markers. */
export function isBulletMarkerSegment(segment: TextSegment): boolean {
	const info = segment.bulletInfo;
	if (!info || info.none || segment.fieldType || segment.isLineBreak) {
		return false;
	}
	if (
		!info.char &&
		!info.autoNumType &&
		!info.imageRelId &&
		!info.imageDataUrl &&
		!info.imageBlipFillXml
	) {
		return false;
	}
	if (info.autoNumType) {
		// Without this runtime field, a literal "1." is authored content (PR 204).
		if (info.paragraphIndex === undefined) {
			return false;
		}
		const marker = markerText(info);
		return segment.text === marker || segment.text === `${marker} `;
	}
	return segment.text === markerText(info);
}

export function paragraphBulletKind(paragraph: readonly TextSegment[]): ParagraphBulletKind {
	const resolved = resolveParagraphBullet(paragraph[0]);
	return resolved ? (resolved.isNumbered ? 'numbered' : 'bullet') : 'none';
}

function withoutListType(style: TextStyle | undefined): TextStyle {
	const next = { ...style };
	delete next.listType;
	return next;
}

function markerText(info: BulletInfo): string {
	if (info.imageRelId || info.imageDataUrl || info.imageBlipFillXml) {
		return '📎 ';
	}
	if (info.autoNumType) {
		return formatAutoNumber(
			info.autoNumType,
			Math.max(1, (info.autoNumStartAt ?? 1) + (info.paragraphIndex ?? 0)),
		);
	}
	return `${info.char ?? DEFAULT_BULLET_CHAR} `;
}

function infoForParagraph(
	previous: BulletInfo | undefined,
	kind: ParagraphBulletKind,
	ordinal?: number,
): BulletInfo {
	if (kind === 'none') {
		return { ...previous, none: true };
	}
	const sameKind =
		previous &&
		(kind === 'numbered'
			? Boolean(previous.autoNumType)
			: Boolean(
					previous.char ||
					previous.imageRelId ||
					previous.imageDataUrl ||
					previous.imageBlipFillXml,
				) && !previous.autoNumType);
	const info = sameKind ? { ...previous } : bulletInfoForKind(kind, ordinal);
	delete info.none;
	if (kind === 'numbered' && ordinal !== undefined) {
		info.paragraphIndex = ordinal;
	}
	return info;
}

/** Explicit set, despite the historical name. Only the leading marker is removed. */
export function toggleParagraphBullet(
	paragraph: readonly TextSegment[],
	kind: ParagraphBulletKind,
	ordinal?: number,
): TextSegment[] {
	const source = paragraph[0];
	if (!source) {
		return [];
	}
	const content = isBulletMarkerSegment(source) ? paragraph.slice(1) : [...paragraph];
	const first = content[0] ?? { text: '', style: source.style };
	const meta = {
		...(source.paragraphLevel !== undefined ? { paragraphLevel: source.paragraphLevel } : {}),
		...(source.paragraphProperties ? { paragraphProperties: source.paragraphProperties } : {}),
		...(source.endParaRunProperties ? { endParaRunProperties: source.endParaRunProperties } : {}),
	};
	const info = infoForParagraph(source.bulletInfo, kind, ordinal);
	const body = { ...first, ...meta, style: withoutListType(first.style) };
	const rest = content.slice(1).map((segment) => {
		if (!segment.bulletInfo) {
			return segment;
		}
		const run = { ...segment };
		delete run.bulletInfo;
		return run;
	});
	// Picture markers render separately; never insert their textual fallback as body.
	if (kind === 'none' || info.imageRelId || info.imageDataUrl || info.imageBlipFillXml) {
		return [{ ...body, bulletInfo: info }, ...rest];
	}
	delete body.bulletInfo;
	const markerStyle =
		isBulletMarkerSegment(source) && paragraphBulletKind([source]) === kind
			? source.style
			: first.style;
	return [
		{ text: markerText(info), style: withoutListType(markerStyle), ...meta, bulletInfo: info },
		body,
		...rest,
	];
}

/** Inclusive paragraph indices; omitted means the entire text element. */
export interface BulletParagraphRange {
	startParagraph: number;
	endParagraph: number;
}

/** Only text properties change; unsupported elements return an empty patch. */
export interface ElementBulletPatch {
	textSegments?: TextSegment[];
	textStyle?: TextStyle;
}

function elementSegments(element: PptxElement): TextSegment[] {
	if (!hasTextProperties(element)) {
		return [];
	}
	if (element.textSegments?.length) {
		return element.textSegments;
	}
	return (element.text ?? '')
		.split('\n')
		.flatMap((text, index) => [
			...(index ? [{ text: '\n', style: { ...element.textStyle }, isParagraphBreak: true }] : []),
			{ text, style: { ...element.textStyle } },
		]);
}

function splitParagraphs(
	segments: readonly TextSegment[],
): Array<{ segments: TextSegment[]; terminator?: TextSegment }> {
	const paragraphs: Array<{ segments: TextSegment[]; terminator?: TextSegment }> = [
		{ segments: [] },
	];
	for (const segment of segments) {
		if (isParagraphSeparatorSegment(segment)) {
			paragraphs[paragraphs.length - 1].terminator = segment;
			paragraphs.push({ segments: [] });
		} else {
			paragraphs[paragraphs.length - 1].segments.push(segment);
		}
	}
	return paragraphs;
}

/** Existing element-wide toggle convention: use its first nonempty paragraph. */
export function elementBulletKind(element: PptxElement): ParagraphBulletKind {
	for (const paragraph of splitParagraphs(elementSegments(element))) {
		if (paragraph.segments.length) {
			return paragraphBulletKind(paragraph.segments);
		}
	}
	return 'none';
}

/**
 * Explicitly set the touched paragraphs. Existing same-kind definitions survive;
 * defaults are only for new lists. Retained buNone metadata supports live off/on,
 * not restoration of a deleted definition after a save/reload.
 */
export function setElementBullets(
	element: PptxElement,
	kind: ParagraphBulletKind,
	range?: BulletParagraphRange,
): ElementBulletPatch {
	if (!hasTextProperties(element)) {
		return {};
	}
	if (
		range &&
		(!Number.isInteger(range.startParagraph) ||
			!Number.isInteger(range.endParagraph) ||
			range.startParagraph < 0 ||
			range.endParagraph < range.startParagraph)
	) {
		return {};
	}
	const paragraphs = splitParagraphs(elementSegments(element));
	if (range && range.startParagraph >= paragraphs.length) {
		return {};
	}
	const next: TextSegment[] = [];
	const sequence = createAutoNumberSequence();
	for (const [index, paragraph] of paragraphs.entries()) {
		const selected = !range || (index >= range.startParagraph && index <= range.endParagraph);
		let segments = paragraph.segments;
		if (selected) {
			const empty = {
				...paragraph.terminator,
				text: '',
				style: { ...paragraph.terminator?.style },
			};
			delete empty.isParagraphBreak;
			delete empty.isLineBreak;
			segments = toggleParagraphBullet(segments.length ? segments : [empty], kind);
		}
		const first = segments[0] ?? paragraph.terminator;
		const info = first?.bulletInfo;
		const level = first?.paragraphLevel ?? 0;
		if (info?.autoNumType && paragraphBulletKind(segments) === 'numbered') {
			const startAt = info.autoNumStartAt ?? 1;
			const ordinal = nextAutoNumber(sequence, level, info.autoNumType, startAt) - startAt;
			// List membership changes also renumber following items. Only this
			// derived ordinal changes outside the selected paragraphs.
			if (info.paragraphIndex !== ordinal) {
				segments = toggleParagraphBullet(segments, 'numbered', ordinal);
			}
		} else {
			breakAutoNumberRun(sequence, level);
		}
		next.push(...segments);
		if (paragraph.terminator) {
			next.push(paragraph.terminator);
		}
	}
	return {
		textSegments: next,
		textStyle: withoutListType(element.textStyle),
	};
}

/** Button intent, unlike the explicit style setter above. */
export function toggleElementBullets(
	element: PptxElement,
	kind: Exclude<ParagraphBulletKind, 'none'>,
): ElementBulletPatch {
	return setElementBullets(element, elementBulletKind(element) === kind ? 'none' : kind);
}
