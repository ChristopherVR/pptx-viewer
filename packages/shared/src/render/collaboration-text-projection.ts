import type { TextSegment } from 'pptx-viewer-core';

import { isBulletMarkerSegment } from './bullet-toggle';
import type { DeltaOp } from './collaboration-text-codec';
import { encodeSegmentsToDelta } from './collaboration-text-codec';
import { inlineListBodyText } from './inline-list-body';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

export interface CollaborationTextSpan {
	readonly segmentIndex: number;
	readonly bodyStart: number;
	readonly bodyEnd: number;
	readonly encodedStart: number;
	readonly encodedEnd: number;
	readonly kind: 'text' | 'paragraph-break' | 'line-break' | 'empty-carrier' | 'bullet-marker';
}

export interface CollaborationTextProjection {
	readonly spans: readonly CollaborationTextSpan[];
	/**
	 * Inclusive candidate bounds, not a chosen insertion position. A non-singleton
	 * interval needs segment provenance or explicit affinity from the DOM adapter.
	 * Validate an interior candidate with encodedOffsetToBody before using it.
	 */
	bodyOffsetToEncoded(offset: number): { start: number; end: number } | undefined;
	encodedOffsetToBody(offset: number): number | undefined;
}

interface EncodedRun {
	text: string;
	attributes: string;
}

/** Y.Text may split/coalesce equal runs or return attributes in another key order. */
function normalizedRuns(delta: readonly DeltaOp[]): EncodedRun[] | undefined {
	const runs: EncodedRun[] = [];
	for (const op of delta) {
		if (typeof op.insert !== 'string') {
			return undefined;
		}
		const entries = Object.entries(op.attributes ?? {});
		if (entries.some(([, value]) => typeof value !== 'string')) {
			return undefined;
		}
		if (!op.insert) {
			continue;
		}
		const attributes = JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b)));
		const previous = runs[runs.length - 1];
		if (previous?.attributes === attributes) {
			previous.text += op.insert;
		} else {
			runs.push({ text: op.insert, attributes });
		}
	}
	return runs;
}

function validBoundary(text: string, offset: number): boolean {
	return (
		Number.isInteger(offset) &&
		offset >= 0 &&
		offset <= text.length &&
		!(
			text.charCodeAt(offset - 1) >= 0xd800 &&
			text.charCodeAt(offset - 1) <= 0xdbff &&
			text.charCodeAt(offset) >= 0xdc00 &&
			text.charCodeAt(offset) <= 0xdfff
		)
	);
}

/**
 * Project an exact pre-input snapshot, never infer segment provenance from text.
 * `body` is the authored DOM body, excluding dedicated bullet markers and ruby
 * annotations. Display substitutions must match the authored body or be rejected.
 */
export function createCollaborationTextProjection(
	segments: readonly TextSegment[],
	delta: readonly DeltaOp[],
	body: string,
): CollaborationTextProjection | undefined {
	if (inlineListBodyText(segments) !== body) {
		return undefined;
	}
	const expected = normalizedRuns(encodeSegmentsToDelta([...segments]));
	const actual = normalizedRuns(delta);
	if (
		!expected ||
		!actual ||
		expected.length !== actual.length ||
		expected.some(
			(run, index) =>
				run.text !== actual[index].text || run.attributes !== actual[index].attributes,
		)
	) {
		return undefined;
	}
	const encoded = actual.map((run) => run.text).join('');
	const spans: CollaborationTextSpan[] = [];
	let bodyStart = 0;
	let encodedStart = 0;
	let first = true;
	for (const [segmentIndex, segment] of segments.entries()) {
		const paragraphBreak = isParagraphSeparatorSegment(segment);
		const marker = !paragraphBreak && first && isBulletMarkerSegment(segment);
		const kind: CollaborationTextSpan['kind'] = paragraphBreak
			? 'paragraph-break'
			: segment.isLineBreak
				? 'line-break'
				: marker
					? 'bullet-marker'
					: segment.text.length === 0
						? 'empty-carrier'
						: 'text';
		const bodyLength = paragraphBreak || segment.isLineBreak ? 1 : marker ? 0 : segment.text.length;
		const encodedLength =
			segment.isParagraphBreak || segment.isLineBreak ? 1 : Math.max(1, segment.text.length);
		spans.push({
			segmentIndex,
			bodyStart,
			bodyEnd: bodyStart + bodyLength,
			encodedStart,
			encodedEnd: encodedStart + encodedLength,
			kind,
		});
		bodyStart += bodyLength;
		encodedStart += encodedLength;
		first = paragraphBreak;
	}
	return {
		spans,
		bodyOffsetToEncoded(offset) {
			if (!validBoundary(body, offset)) {
				return undefined;
			}
			let start = encoded.length;
			let end = 0;
			for (const span of spans) {
				if (offset < span.bodyStart || offset > span.bodyEnd) {
					continue;
				}
				const point = span.encodedStart + offset - span.bodyStart;
				start = Math.min(start, point);
				end = Math.max(end, span.bodyStart === span.bodyEnd ? span.encodedEnd : point);
			}
			return { start, end };
		},
		encodedOffsetToBody(offset) {
			if (!validBoundary(encoded, offset)) {
				return undefined;
			}
			for (const span of spans) {
				if (offset >= span.encodedStart && offset <= span.encodedEnd) {
					const point =
						span.bodyStart === span.bodyEnd
							? span.bodyStart
							: span.bodyStart + offset - span.encodedStart;
					return validBoundary(body, point) ? point : undefined;
				}
			}
			return 0;
		},
	};
}
