/**
 * animation-timeline-rows.test.ts: unit tests for the merged editor +
 * deck-native animation timeline used to drive full-sequence drag-to-reorder.
 */
import type { PptxAnimationTimelineAnchor, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	applyAnimationTimelineOrder,
	buildAnimationTimelineRows,
	reorderAnimationTimelineRows,
} from './animation-timeline-rows';

const ANIMATIONS: PptxElementAnimation[] = [
	{ elementId: 'editor-a', entrance: 'fadeIn', order: 1 },
	{ elementId: 'editor-b', entrance: 'flyIn', order: 3 },
];

const ANCHORS: PptxAnimationTimelineAnchor[] = [
	{ order: 0, targetIds: ['native-1'], presetClasses: ['entr'] },
	{ order: 2, targetIds: ['native-2', 'native-3'], presetClasses: ['entr', 'exit'] },
];

describe('buildAnimationTimelineRows', () => {
	it('merges editor and native rows sorted by order', () => {
		const rows = buildAnimationTimelineRows(ANIMATIONS, ANCHORS);
		expect(rows.map((r) => r.key)).toStrictEqual([
			'native:0',
			'editor:editor-a',
			'native:2',
			'editor:editor-b',
		]);
	});

	it('returns only editor rows when there are no anchors', () => {
		const rows = buildAnimationTimelineRows(ANIMATIONS);
		expect(rows).toHaveLength(2);
		expect(rows.every((r) => r.kind === 'editor')).toBeTruthy();
	});

	it('defaults a missing order to 0', () => {
		const rows = buildAnimationTimelineRows([{ elementId: 'x', entrance: 'fadeIn' }]);
		expect(rows[0]?.order).toBe(0);
	});
});

describe('reorderAnimationTimelineRows', () => {
	it('moves an editor row ahead of a native anchor', () => {
		const rows = buildAnimationTimelineRows(ANIMATIONS, ANCHORS);
		// Drag editor-b (currently last) to the very front, ahead of native:0.
		const reordered = reorderAnimationTimelineRows(rows, 'editor:editor-b', 0);
		expect(reordered.map((r) => r.key)).toStrictEqual([
			'editor:editor-b',
			'native:0',
			'editor:editor-a',
			'native:2',
		]);
		expect(reordered.map((r) => r.order)).toStrictEqual([0, 1, 2, 3]);
	});

	it('moves an editor row behind a native anchor it used to precede', () => {
		const rows = buildAnimationTimelineRows(ANIMATIONS, ANCHORS);
		// Drag editor-a (currently between the two anchors) to the very end.
		const reordered = reorderAnimationTimelineRows(rows, 'editor:editor-a', 3);
		expect(reordered.map((r) => r.key)).toStrictEqual([
			'native:0',
			'native:2',
			'editor:editor-b',
			'editor:editor-a',
		]);
	});

	it('no-ops and re-normalises order when the source key is unknown', () => {
		const rows = buildAnimationTimelineRows(ANIMATIONS, ANCHORS);
		const reordered = reorderAnimationTimelineRows(rows, 'editor:missing', 0);
		expect(reordered.map((r) => r.key)).toStrictEqual(rows.map((r) => r.key));
		expect(reordered.map((r) => r.order)).toStrictEqual([0, 1, 2, 3]);
	});

	it('no-ops when the target index is out of range', () => {
		const rows = buildAnimationTimelineRows(ANIMATIONS, ANCHORS);
		const reordered = reorderAnimationTimelineRows(rows, 'editor:editor-a', 99);
		expect(reordered.map((r) => r.key)).toStrictEqual(rows.map((r) => r.key));
	});
});

describe('applyAnimationTimelineOrder', () => {
	it('writes new order values back onto matching editor animations only', () => {
		const rows = buildAnimationTimelineRows(ANIMATIONS, ANCHORS);
		const reordered = reorderAnimationTimelineRows(rows, 'editor:editor-b', 0);
		const applied = applyAnimationTimelineOrder(ANIMATIONS, reordered);
		expect(applied.find((a) => a.elementId === 'editor-b')?.order).toBe(0);
		expect(applied.find((a) => a.elementId === 'editor-a')?.order).toBe(2);
	});

	it('leaves animations untouched when no row names their elementId', () => {
		const applied = applyAnimationTimelineOrder(ANIMATIONS, []);
		expect(applied).toStrictEqual(ANIMATIONS);
	});

	it('does not mutate the input array', () => {
		const rows = buildAnimationTimelineRows(ANIMATIONS, ANCHORS);
		const reordered = reorderAnimationTimelineRows(rows, 'editor:editor-b', 0);
		applyAnimationTimelineOrder(ANIMATIONS, reordered);
		expect(ANIMATIONS[0]?.order).toBe(1);
		expect(ANIMATIONS[1]?.order).toBe(3);
	});
});
