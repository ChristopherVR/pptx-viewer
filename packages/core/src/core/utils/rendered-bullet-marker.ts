/**
 * Recognise the display-only bullet-marker segment the parser prepends to a
 * bulleted paragraph (`"• "`, an auto-number such as `"1. "`, or an empty
 * picture-bullet carrier). The bullet itself is paragraph metadata
 * (`bulletInfo`), so every writer (the `.pptx` save's paragraph builder and
 * the `.ppt` writer's `text-segments-to-paragraphs.ts`) must skip this
 * segment rather than write its text as a run, or the bullet is doubled.
 *
 * @module utils/rendered-bullet-marker
 */

import type { TextSegment } from '../types';
import { formatAutoNumberMarker } from './auto-number-format';

/** True when `segment` is the parser's rendered bullet marker for its paragraph. */
export function isRenderedBulletMarker(segment: TextSegment): boolean {
	const bullet = segment.bulletInfo;
	if (!bullet || bullet.none) {
		return false;
	}
	if (
		segment.text === '' &&
		(bullet.imageRelId || bullet.imageDataUrl) &&
		!segment.fieldType &&
		!segment.equationXml &&
		segment.rubyText === undefined
	) {
		return true;
	}
	if (bullet.autoNumType) {
		if (bullet.paragraphIndex === undefined) {
			return false;
		}
		const ordinal = Math.max(1, (bullet.autoNumStartAt ?? 1) + bullet.paragraphIndex);
		const marker = formatAutoNumberMarker(bullet.autoNumType, ordinal);
		return segment.text === marker || segment.text === `${marker} `;
	}
	const marker = bullet.char
		? `${bullet.char} `
		: bullet.imageRelId || bullet.imageDataUrl
			? '\u{1F4CE} '
			: '• ';
	return segment.text === marker;
}
