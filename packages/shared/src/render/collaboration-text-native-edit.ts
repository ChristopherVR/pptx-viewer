import type { TextSegment } from 'pptx-viewer-core';

import type { DeltaOp } from './collaboration-text-codec';
import { encodeSegmentsToDelta } from './collaboration-text-codec';
import type {
	CollaborationTextProjection,
	CollaborationTextSpan,
} from './collaboration-text-projection';
import { createCollaborationTextProjection } from './collaboration-text-projection';
import type {
	LocalTextReplacement,
	TextSessionCorrespondence,
} from './collaboration-text-session-delta';
import {
	textSessionReplacementSpan,
	textSessionRetainedIndices,
} from './collaboration-text-session-delta';

interface NativeTextSnapshot {
	segments: readonly TextSegment[];
	body: string;
}

interface NativeTextEdit {
	delta: DeltaOp[];
	correspondence: TextSessionCorrespondence;
}

/** The first segment, or a terminating break for a genuinely empty paragraph. */
function paragraphCarriers(
	projection: CollaborationTextProjection,
): Array<CollaborationTextSpan | undefined> {
	const carriers: Array<CollaborationTextSpan | undefined> = [undefined];
	for (const span of projection.spans) {
		carriers[carriers.length - 1] ??= span;
		if (span.kind === 'paragraph-break') {
			carriers.push(undefined);
		}
	}
	return carriers;
}

function bodyUnits(projection: CollaborationTextProjection): number[] {
	const indices: number[] = [];
	for (const span of projection.spans) {
		for (let body = span.bodyStart; body < span.bodyEnd; body++) {
			indices[body] = span.encodedStart + body - span.bodyStart;
		}
	}
	return indices;
}

/**
 * Translate a known native replacement into retained encoded identities.
 * Paragraph provenance must come from the adapter's before/after DOM snapshots,
 * not matching labels or guessing which paragraph a paste/deletion inherited.
 */
export function createNativeCollaborationTextEdit(
	before: NativeTextSnapshot & { delta: readonly DeltaOp[] },
	after: NativeTextSnapshot & {
		/** One previous carrier segment index per paragraph; null means new/default. */
		paragraphSources: readonly (number | null)[];
		/** One previous segment index per zero-body span; null explicitly means new. */
		hiddenSources: readonly (number | null)[];
	},
	replacement: LocalTextReplacement,
): NativeTextEdit | undefined {
	const range = textSessionReplacementSpan(before.body, after.body, replacement);
	const delta = encodeSegmentsToDelta([...after.segments]);
	const oldProjection = createCollaborationTextProjection(
		before.segments,
		before.delta,
		before.body,
	);
	const nextProjection = createCollaborationTextProjection(after.segments, delta, after.body);
	if (!range || !oldProjection || !nextProjection) {
		return undefined;
	}
	const oldCarriers = new Map(
		paragraphCarriers(oldProjection).flatMap((span) =>
			span ? [[span.segmentIndex, span] as const] : [],
		),
	);
	const nextCarriers = paragraphCarriers(nextProjection);
	if (
		after.paragraphSources.length !== nextCarriers.length ||
		Array.from(after.paragraphSources).some(
			(source) => source !== null && (!Number.isInteger(source) || !oldCarriers.has(source)),
		)
	) {
		return undefined;
	}
	const oldText = before.delta.map((op) => op.insert as string).join('');
	const nextText = delta.map((op) => op.insert as string).join('');
	const oldBody = bodyUnits(oldProjection);
	const nextBody = bodyUnits(nextProjection);
	const retainedIndices: (number | null)[] = Array(nextText.length).fill(null);
	const paragraphSources: (number | null)[] = Array(nextText.length).fill(null);
	const afterEnd = after.body.length - range.suffix;
	for (const [bodyIndex, encodedIndex] of nextBody.entries()) {
		const previous =
			bodyIndex < range.prefix
				? bodyIndex
				: bodyIndex >= afterEnd
					? before.body.length - (after.body.length - bodyIndex)
					: undefined;
		if (previous !== undefined) {
			retainedIndices[encodedIndex] = oldBody[previous];
		}
	}
	for (const [paragraph, carrier] of nextCarriers.entries()) {
		const source = after.paragraphSources[paragraph];
		const oldCarrier = source === null ? undefined : oldCarriers.get(source);
		if (!carrier || !oldCarrier) {
			continue;
		}
		paragraphSources.fill(oldCarrier.encodedStart, carrier.encodedStart, carrier.encodedEnd);
	}
	const hidden = nextProjection.spans.filter((span) => span.bodyStart === span.bodyEnd);
	if (after.hiddenSources.length !== hidden.length) {
		return undefined;
	}
	for (const [index, carrier] of hidden.entries()) {
		const source = after.hiddenSources[index];
		if (source === null) {
			continue;
		}
		const oldCarrier = oldProjection.spans[source];
		if (
			!Number.isInteger(source) ||
			!oldCarrier ||
			oldCarrier.bodyStart !== oldCarrier.bodyEnd ||
			oldCarrier.kind !== carrier.kind ||
			oldText.slice(oldCarrier.encodedStart, oldCarrier.encodedEnd) !==
				nextText.slice(carrier.encodedStart, carrier.encodedEnd)
		) {
			return undefined;
		}
		for (let unit = carrier.encodedStart; unit < carrier.encodedEnd; unit++) {
			retainedIndices[unit] = oldCarrier.encodedStart + unit - carrier.encodedStart;
		}
	}
	const correspondence = { retainedIndices, paragraphSources };
	return textSessionRetainedIndices(oldText, nextText, correspondence)
		? { delta, correspondence }
		: undefined;
}
