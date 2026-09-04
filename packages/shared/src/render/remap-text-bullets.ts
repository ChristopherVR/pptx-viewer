import type { TextSegment } from 'pptx-viewer-core';

import { resolveParagraphBullet } from './bullet-list';
import { isBulletMarkerSegment } from './bullet-toggle';

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
 * Advance an appended paragraph from the final authored auto-numbered item.
 * Core stores the list-relative ordinal as `paragraphIndex`; copying the final
 * item unchanged would render every paragraph added with Enter as the same
 * number. The literal marker is refreshed only when core supplied a dedicated
 * display-marker segment. The donor's list level is retained because core
 * sequences each level independently when the deck is reloaded. Other bullet
 * kinds and auto-numbers without a known runtime index remain unchanged.
 */
export function continueAutoNumberedParagraph(
	segments: TextSegment[],
	donorSegments: readonly TextSegment[],
	offset: number,
): TextSegment[] {
	const donor = donorSegments[0];
	const paragraphIndex = donor?.bulletInfo?.paragraphIndex;
	if (
		segments.length === 0 ||
		!donor?.bulletInfo?.autoNumType ||
		typeof paragraphIndex !== 'number' ||
		!Number.isFinite(paragraphIndex)
	) {
		return segments;
	}

	const [first, ...rest] = segments;
	const continued: TextSegment = {
		...first,
		bulletInfo: {
			...donor.bulletInfo,
			paragraphIndex: paragraphIndex + offset,
		},
	};
	if (donor.paragraphLevel !== undefined) {
		continued.paragraphLevel = donor.paragraphLevel;
	}

	if (isBulletMarkerSegment(donor)) {
		const resolved = resolveParagraphBullet(continued);
		if (resolved) {
			const trailingWhitespace = donor.text.match(/\s+$/u)?.[0] ?? '';
			continued.text = `${resolved.marker}${trailingWhitespace}`;
		}
	}

	return [continued, ...rest];
}
