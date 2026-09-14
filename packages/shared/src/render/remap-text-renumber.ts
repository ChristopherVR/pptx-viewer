/**
 * Re-sequence auto-numbered paragraphs after an inline edit moved, added or
 * removed list items.
 *
 * Core publishes each numbered paragraph's ordinal offset as
 * `bulletInfo.paragraphIndex` at load (see `BulletInfo.paragraphIndex`) and the
 * renderer paints `autoNumStartAt + paragraphIndex`. After a paragraph is
 * inserted into or deleted from the middle of a list, every later item still
 * carries the offset of its old position, so the list shows a duplicate or a
 * skipped number until the deck is reloaded. Worse, the save writer drops the
 * display-only marker segment only while its text agrees with the stored
 * offset, so a stale pair would be written back as literal text.
 *
 * The pass mirrors core's `auto-number-sequence` rules for what makes one
 * list: an unbroken run of paragraphs at the same level using the same
 * scheme; a non-numbered paragraph ends the run at its level and every deeper
 * one, and a numbered paragraph restarts the levels nested beneath it. Unlike
 * core it is RELATIVE: the first paragraph of a run keeps whatever offset it
 * has (a body may legitimately start mid-list, and an offset core did not
 * assign is not invented), and each following item is set to the previous one
 * plus one. A well-formed body is therefore returned unchanged.
 */
import type { TextSegment } from 'pptx-viewer-core';

import { withAutoNumberIndex } from './remap-text-bullets';

/** Re-sequence the `paragraphIndex` (and marker text) of each numbered run. */
export function resequenceAutoNumbering(paragraphs: readonly TextSegment[][]): TextSegment[][] {
	const running = new Map<number, { scheme: string; index: number }>();
	const forgetFrom = (level: number): void => {
		for (const recorded of [...running.keys()]) {
			if (recorded >= level) {
				running.delete(recorded);
			}
		}
	};
	return paragraphs.map((segments) => {
		const first = segments[0];
		const level = first?.paragraphLevel ?? 0;
		const scheme = first?.bulletInfo?.autoNumType;
		if (!first || !scheme) {
			forgetFrom(level);
			return segments;
		}
		forgetFrom(level + 1);
		const stored = first.bulletInfo?.paragraphIndex;
		if (typeof stored !== 'number' || !Number.isFinite(stored)) {
			// No runtime offset to continue from: the run's count is unknown.
			running.delete(level);
			return segments;
		}
		const previous = running.get(level);
		const index = previous && previous.scheme === scheme ? previous.index + 1 : stored;
		running.set(level, { scheme, index });
		if (index === stored) {
			return segments;
		}
		return [withAutoNumberIndex(first, index), ...segments.slice(1)];
	});
}
