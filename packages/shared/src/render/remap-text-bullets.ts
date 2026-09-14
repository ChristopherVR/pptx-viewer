import type { TextSegment } from 'pptx-viewer-core';
import { breakAutoNumberRun, createAutoNumberSequence, nextAutoNumber } from 'pptx-viewer-core';

import { resolveParagraphBullet } from './bullet-list';
import { isBulletMarkerSegment } from './bullet-toggle';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

function trailingWhitespace(text: string): string {
	return text.slice(text.trimEnd().length);
}

/** Refresh only derived ordinals after existing paragraphs have moved. */
export function renumberRemappedParagraphs(segments: TextSegment[]): TextSegment[] {
	const sequence = createAutoNumberSequence();
	let first = true;
	return segments.map((segment) => {
		const paragraphStart = first;
		first = isParagraphSeparatorSegment(segment);
		if (!paragraphStart) {
			return segment;
		}
		const info = segment.bulletInfo;
		const level = segment.paragraphLevel ?? 0;
		if (!info?.autoNumType || !resolveParagraphBullet(segment)?.isNumbered) {
			breakAutoNumberRun(sequence, level);
			return segment;
		}
		const ordinal =
			nextAutoNumber(sequence, level, info.autoNumType, info.autoNumStartAt ?? 1) -
			(info.autoNumStartAt ?? 1);
		// An unknown runtime index may accompany literal marker-like body text.
		if (info.paragraphIndex === undefined || info.paragraphIndex === ordinal) {
			return segment;
		}
		const updated = { ...segment, bulletInfo: { ...info, paragraphIndex: ordinal } };
		if (isBulletMarkerSegment(segment)) {
			const resolved = resolveParagraphBullet(updated);
			if (resolved) {
				updated.text = resolved.marker + trailingWhitespace(segment.text);
			}
		}
		return updated;
	});
}

/** Returns the editor-only display marker that begins a listed paragraph. */
export function dedicatedBulletMarker(
	paragraphSegments: readonly TextSegment[],
): TextSegment | undefined {
	const first = paragraphSegments[0];
	if (!first || !isBulletMarkerSegment(first)) {
		return undefined;
	}
	return !first.bulletInfo?.autoNumType || first.bulletInfo.paragraphIndex !== undefined
		? first
		: undefined;
}

/** Updates an auto-number's derived ordinal and its display marker text. */
export function withAutoNumberIndex(
	first: TextSegment,
	paragraphIndex: number,
	isMarker: boolean = isBulletMarkerSegment(first),
): TextSegment {
	const next: TextSegment = { ...first, bulletInfo: { ...first.bulletInfo, paragraphIndex } };
	if (isMarker) {
		const resolved = resolveParagraphBullet(next);
		if (resolved) {
			next.text = `${resolved.marker}${trailingWhitespace(first.text)}`;
		}
	}
	return next;
}

/** Remove a display-only marker from editor text before remapping its content. */
export function withoutRenderedBulletPrefix(
	text: string,
	originalSegments: readonly TextSegment[],
	dedicatedMarker: TextSegment | undefined,
): string {
	if (!dedicatedMarker) {
		return text;
	}
	const resolved = resolveParagraphBullet(dedicatedMarker);
	if (!resolved || !text.startsWith(resolved.marker)) {
		return text;
	}

	const withoutMarker = text.slice(resolved.marker.length);
	const originalContent = originalSegments
		.slice(1)
		.map((segment) => segment.text)
		.join('');
	// Empty list paragraphs do not render a marker, so marker-like text typed
	// into them is authored content and must not be stripped.
	if (originalContent.trim().length === 0) {
		return text;
	}
	const originalLeadingSpaces = originalContent.length - originalContent.trimStart().length;
	const editedLeadingSpaces = withoutMarker.length - withoutMarker.trimStart().length;
	if (editedLeadingSpaces > originalLeadingSpaces) {
		return withoutMarker.slice(1);
	}
	return withoutMarker;
}

/**
 * Continue an inserted paragraph from the immediately preceding list item.
 * Core stores the list-relative ordinal as `paragraphIndex`; copying the final
 * item unchanged would render every paragraph added with Enter as the same
 * number. The literal marker is refreshed only when core supplied a dedicated
 * display-marker segment. The donor's list level is retained because core
 * sequences each level independently when the deck is reloaded. Other bullet
 * kinds retain their definition and level; unknown auto-number indices stay unknown.
 */
export function continueListParagraph(
	segments: TextSegment[],
	donorSegments: readonly TextSegment[],
): TextSegment[] {
	const donor = donorSegments[0];
	const paragraphIndex = donor?.bulletInfo?.paragraphIndex;
	const bullet = resolveParagraphBullet(donor);
	if (segments.length === 0 || !bullet) {
		return segments;
	}
	if (
		bullet.isNumbered &&
		(typeof paragraphIndex !== 'number' || !Number.isFinite(paragraphIndex))
	) {
		return segments;
	}

	const [first, ...rest] = segments;
	const continued: TextSegment = {
		...first,
		bulletInfo: {
			...donor.bulletInfo,
			...(bullet.isNumbered && typeof paragraphIndex === 'number' && Number.isFinite(paragraphIndex)
				? { paragraphIndex: paragraphIndex + 1 }
				: {}),
		},
	};
	if (donor.paragraphLevel !== undefined) {
		continued.paragraphLevel = donor.paragraphLevel;
	}

	if (
		bullet.isNumbered &&
		typeof paragraphIndex === 'number' &&
		Number.isFinite(paragraphIndex) &&
		isBulletMarkerSegment(donor)
	) {
		const resolved = resolveParagraphBullet(continued);
		if (resolved) {
			continued.text = `${resolved.marker}${trailingWhitespace(donor.text)}`;
		}
	}

	return [continued, ...rest];
}
