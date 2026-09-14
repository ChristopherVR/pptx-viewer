import type { TextSegment } from 'pptx-viewer-core';
import {
	ELEMENT_PARAGRAPH_GEOMETRY_KEYS,
	breakAutoNumberRun,
	createAutoNumberSequence,
	nextAutoNumber,
} from 'pptx-viewer-core';

import { resolveParagraphBullet } from './bullet-list';
import { isBulletMarkerSegment } from './bullet-toggle';
import { readInlineListRuns } from './inline-list-run-reader';
import { inlineListParagraphMetadata, inlineListSession } from './inline-list-seed';
import type { InlineListReadResult, InlineListSeed } from './inline-list-types';
import { readEditableText } from './inline-text-extract';
import { buildParagraphs } from './text-paragraphs';

export function readInlineListSnapshot(
	seed: InlineListSeed,
	root: HTMLElement,
): InlineListReadResult {
	const fallback = (reason: string): InlineListReadResult => ({
		kind: 'unsupported',
		reason,
		text: readEditableText(root),
	});
	const session = inlineListSession(seed);
	if (!session) {
		return fallback('unknown-session');
	}
	const blocks = Array.from(root.childNodes).filter(
		(node) => node.nodeType === 1 || (node.nodeType === 3 && Boolean(node.nodeValue)),
	);
	if (
		blocks.some((node) => !(node instanceof HTMLElement) || !['DIV', 'P'].includes(node.tagName))
	) {
		return fallback('unsupported-paragraph-structure');
	}
	const segments: TextSegment[] = [];
	const text: string[] = [];
	const sequence = createAutoNumberSequence();
	let unchanged = blocks.length === seed.paragraphs.length;
	for (const [position, node] of blocks.entries()) {
		const block = node as HTMLElement;
		const original = session.paragraphNodes.get(block);
		const token = block.dataset.pptxListParagraph ?? '';
		const format = session.formats.get(token);
		if (!format) {
			return fallback('unknown-paragraph-token');
		}
		const sourceIndex = original ?? session.paragraphTokens.get(token);
		const source = sourceIndex === undefined ? undefined : session.paragraphs[sourceIndex];
		const carrier = source?.segments[0] ?? source?.terminator;
		// Native full-body replacement may remove every run wrapper. The validated
		// paragraph descriptor still supplies body context, never marker metadata.
		const bodyStyle =
			sourceIndex === undefined ? undefined : seed.paragraphs[sourceIndex]?.runs[0]?.style;
		const body = readInlineListRuns(session, block, bodyStyle);
		if (!body) {
			return fallback('unsupported-run-structure');
		}
		const { runs } = body;
		const bodyText = runs.map((run) => run.text).join('');
		text.push(bodyText);
		unchanged &&=
			original === position &&
			token === seed.paragraphs[position].token &&
			body.unchanged &&
			bodyText === seed.paragraphs[position].runs.map((run) => run.text).join('') &&
			runs.every(
				(run, index) =>
					JSON.stringify(run.style) ===
					JSON.stringify(seed.paragraphs[position].runs[index]?.style),
			);
		if (!runs.length) {
			runs.push({
				text: '',
				style: structuredClone(carrier?.paragraphInsertionStyle ?? carrier?.style ?? {}),
			});
		}
		if (carrier) {
			if (original !== undefined) {
				Object.assign(runs[0], inlineListParagraphMetadata(carrier));
			}
		}
		const first = runs[0];
		delete first.style.listType;
		first.bulletInfo = format.bulletInfo ? structuredClone(format.bulletInfo) : undefined;
		first.paragraphLevel = format.paragraphLevel;
		if (format.paragraphProperties) {
			const geometry = { ...first.paragraphProperties };
			for (const key of ELEMENT_PARAGRAPH_GEOMETRY_KEYS) {
				delete geometry[key];
			}
			first.paragraphProperties = { ...geometry, ...structuredClone(format.paragraphProperties) };
		}
		if (bodyText.length > 0) {
			delete first.paragraphInsertionStyle;
		} else if (first.paragraphInsertionStyle) {
			first.paragraphInsertionStyle = structuredClone(first.style);
		}
		const bullet = resolveParagraphBullet(first);
		if (bullet?.isNumbered && first.bulletInfo?.autoNumType) {
			const start = first.bulletInfo.autoNumStartAt ?? 1;
			first.bulletInfo.paragraphIndex =
				nextAutoNumber(sequence, first.paragraphLevel ?? 0, first.bulletInfo.autoNumType, start) -
				start;
		} else {
			breakAutoNumberRun(sequence, first.paragraphLevel ?? 0);
		}
		if (isBulletMarkerSegment(first)) {
			// The native body can literally equal its marker. Use the established
			// marker-plus-body representation so legacy consumers skip only chrome.
			const marker = {
				text: first.text,
				style: structuredClone(
					carrier && isBulletMarkerSegment(carrier) ? carrier.style : first.style,
				),
				...inlineListParagraphMetadata(first),
			};
			for (const key of [
				'bulletInfo',
				'paragraphLevel',
				'paragraphProperties',
				'endParaRunProperties',
				'paragraphInsertionStyle',
			] as const) {
				delete first[key];
			}
			runs.unshift(marker);
		}
		if (position > 0) {
			segments.push({ text: '\n', style: {}, isParagraphBreak: true });
		}
		segments.push(...runs);
	}
	const textSegments = unchanged ? structuredClone(session.originalSegments) : segments;
	const snapshot = { elementId: seed.elementId, text: text.join('\n'), textSegments };
	return {
		kind: 'supported',
		snapshot,
		paragraphs: buildParagraphs(session.element, undefined, textSegments, {
			preserveTrailingEmpty: true,
		}),
	};
}
