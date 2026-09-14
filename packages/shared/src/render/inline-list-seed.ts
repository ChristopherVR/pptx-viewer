import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { ELEMENT_PARAGRAPH_GEOMETRY_KEYS, hasTextProperties } from 'pptx-viewer-core';

import { resolveParagraphBullet } from './bullet-list';
import { isBulletMarkerSegment } from './bullet-toggle';
import type {
	InlineListParagraphFormat,
	InlineListSeed,
	InlineListSession,
} from './inline-list-types';
import { buildParagraphs } from './text-paragraphs';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

const sessions = new WeakMap<InlineListSeed, InlineListSession>();
let nextSession = 0;

/** Seed descriptors once; native edits own the mounted DOM for the entire session. */
export function createInlineListSeed(element: PptxElement): InlineListSeed | undefined {
	if (
		!hasTextProperties(element) ||
		!element.textSegments?.some((segment) => resolveParagraphBullet(segment))
	) {
		return undefined;
	}
	const segments = structuredClone(element.textSegments);
	const paragraphs: InlineListSession['paragraphs'] = [{ segments: [] }];
	const indices: number[][] = [[]];
	for (const [index, segment] of segments.entries()) {
		if (isParagraphSeparatorSegment(segment)) {
			paragraphs.at(-1)!.terminator = segment;
			paragraphs.push({ segments: [] });
			indices.push([]);
		} else {
			paragraphs.at(-1)!.segments.push(segment);
			indices.at(-1)!.push(index);
		}
	}
	const presentation = buildParagraphs(element, undefined, undefined, {
		preserveTrailingEmpty: true,
	});
	const prefix = `list-${++nextSession}`;
	const originalSegments = structuredClone(segments);
	// An empty paragraph still needs a body-style token, never the marker's font.
	const virtualIndices = new Map<number, number>();
	for (const [index, paragraph] of paragraphs.entries()) {
		if (
			paragraph.segments.every(
				(segment, runIndex) =>
					(runIndex === 0 && isBulletMarkerSegment(segment)) ||
					(segment.text === '' &&
						!segment.isLineBreak &&
						!segment.fieldType &&
						!segment.fieldGuid &&
						!segment.equationXml &&
						!segment.rubyText),
			)
		) {
			const carrier = paragraph.segments[0] ?? paragraph.terminator;
			const body = paragraph.segments.find((segment) => !isBulletMarkerSegment(segment));
			virtualIndices.set(index, segments.length);
			segments.push({
				text: '',
				style: structuredClone(
					carrier?.paragraphInsertionStyle ?? body?.style ?? element.textStyle ?? {},
				),
			});
		}
	}
	const seed: InlineListSeed = Object.freeze({
		elementId: element.id,
		paragraphs: Object.freeze(
			paragraphs.map((paragraph, sourceIndex) =>
				Object.freeze({
					token: `${prefix}-p${sourceIndex}`,
					sourceIndex,
					presentation: presentation[sourceIndex],
					runs: Object.freeze(
						(virtualIndices.has(sourceIndex)
							? [segments[virtualIndices.get(sourceIndex)!]]
							: paragraph.segments
						).flatMap((segment, index) => {
							if (index === 0 && isBulletMarkerSegment(segment)) {
								return [];
							}
							const segmentIndex = virtualIndices.get(sourceIndex) ?? indices[sourceIndex][index];
							return [
								Object.freeze({
									token: `${prefix}-r${segmentIndex}`,
									segmentIndex,
									text: segment.isLineBreak ? '\n' : segment.text,
									style: Object.freeze(structuredClone(segment.style)),
									...(segment.isLineBreak ? { isLineBreak: true as const } : {}),
								}),
							];
						}),
					),
				}),
			),
		),
	});
	sessions.set(seed, {
		element: structuredClone(element),
		segments,
		originalSegments,
		paragraphs,
		paragraphNodes: new WeakMap(),
		runNodes: new WeakMap(),
		boundParagraphs: new Set(),
		boundRuns: new Set(),
		runCss: new Map(),
		runHtml: new Map(),
		runChildren: new Map(),
		formats: new Map(
			seed.paragraphs.map((paragraph) => {
				const source = paragraphs[paragraph.sourceIndex];
				const first = source.segments[0] ?? source.terminator;
				return [
					paragraph.token,
					{
						bulletInfo:
							first?.style.listType === 'none'
								? { ...first.bulletInfo, none: true }
								: first?.bulletInfo,
						paragraphLevel: first?.paragraphLevel,
						paragraphProperties: paragraphFormatGeometry(first?.paragraphProperties),
					},
				];
			}),
		),
		paragraphTokens: new Map(
			seed.paragraphs.map((paragraph) => [paragraph.token, paragraph.sourceIndex]),
		),
		runTokens: new Map(
			seed.paragraphs.flatMap((paragraph) =>
				paragraph.runs.map((run) => [run.token, run.segmentIndex]),
			),
		),
	});
	return seed;
}

/** Internal accessor, intentionally omitted from package exports. */
export function inlineListSession(seed: InlineListSeed): InlineListSession | undefined {
	return sessions.get(seed);
}

export function bindInlineListParagraph(
	seed: InlineListSeed,
	node: Node,
	sourceIndex: number,
): boolean {
	const session = sessions.get(seed);
	if (!session?.paragraphs[sourceIndex] || session.boundParagraphs.has(sourceIndex)) {
		return false;
	}
	if (session.paragraphNodes.has(node)) {
		return false;
	}
	session.paragraphNodes.set(node, sourceIndex);
	session.boundParagraphs.add(sourceIndex);
	return true;
}

export function bindInlineListRun(seed: InlineListSeed, node: Node, segmentIndex: number): boolean {
	const session = sessions.get(seed);
	if (!session?.segments[segmentIndex] || session.boundRuns.has(segmentIndex)) {
		return false;
	}
	if (session.runNodes.has(node)) {
		return false;
	}
	session.runNodes.set(node, segmentIndex);
	session.boundRuns.add(segmentIndex);
	if (node instanceof HTMLElement) {
		session.runCss.set(segmentIndex, node.style.cssText);
		session.runHtml.set(segmentIndex, node.innerHTML);
		session.runChildren.set(segmentIndex, inlineListDescendants(node));
	}
	return true;
}

export function inlineListDescendants(node: Node): Node[] {
	return Array.from(node.childNodes).flatMap((child) => [child, ...inlineListDescendants(child)]);
}

/** Register explicit command output; applying the returned token is the adapter's edit. */
export function registerInlineListParagraphFormat(
	seed: InlineListSeed,
	format: InlineListParagraphFormat,
): string | undefined {
	const session = sessions.get(seed);
	if (!session) {
		return undefined;
	}
	const token = `${seed.paragraphs[0].token}-format${session.formats.size}`;
	session.formats.set(token, {
		...structuredClone(format),
		paragraphProperties: paragraphFormatGeometry(format.paragraphProperties),
	});
	return token;
}

function paragraphFormatGeometry(style: TextStyle | undefined): TextStyle | undefined {
	if (!style) {
		return undefined;
	}
	return Object.fromEntries(
		ELEMENT_PARAGRAPH_GEOMETRY_KEYS.flatMap((key) =>
			style[key] === undefined ? [] : [[key, structuredClone(style[key])]],
		),
	);
}

/** Character formatting tokens never grant field or paragraph source identity. */
export function registerInlineListRunStyle(
	seed: InlineListSeed,
	style: TextStyle,
	renderedCss?: string,
): string | undefined {
	const session = sessions.get(seed);
	if (!session) {
		return undefined;
	}
	const index = session.segments.length;
	const token = `${seed.paragraphs[0].token}-style${index}`;
	session.segments.push({ text: '', style: structuredClone(style) });
	session.runTokens.set(token, index);
	if (renderedCss !== undefined) {
		session.runCss.set(index, renderedCss);
	}
	return token;
}

export function inlineListParagraphMetadata(source: TextSegment): Partial<TextSegment> {
	return {
		...(source.bulletInfo ? { bulletInfo: structuredClone(source.bulletInfo) } : {}),
		...(source.paragraphLevel !== undefined ? { paragraphLevel: source.paragraphLevel } : {}),
		...(source.paragraphProperties
			? { paragraphProperties: structuredClone(source.paragraphProperties) }
			: {}),
		...(source.endParaRunProperties
			? { endParaRunProperties: structuredClone(source.endParaRunProperties) }
			: {}),
		...(source.paragraphInsertionStyle
			? { paragraphInsertionStyle: structuredClone(source.paragraphInsertionStyle) }
			: {}),
	};
}
