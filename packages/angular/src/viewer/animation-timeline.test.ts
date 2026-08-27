/* oxlint-disable eslint/one-var -- each `it` block below declares its own
   independent fixture locals; merging unrelated declarations across these
   test cases would hurt readability, not help it. */
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildAnimationTimelineRows,
	moveAnimationTimelineRowBy,
	reorderAnimationTo,
} from '../internal/shared';
import { getAnimationElementLabel, getAnimationTriggerElements } from './animation-author-view';
import { buildAnimationTimelineBars } from './animation-timeline.component';

const animations = [
	{ elementId: 'a', order: 0, durationMs: 200 },
	{ elementId: 'b', order: 1, durationMs: 400, delayMs: 100 },
	{ elementId: 'c', order: 2, durationMs: 300 },
] as PptxElementAnimation[];

describe('angular animation timeline', () => {
	it('reorders a dragged animation and normalizes every order', () => {
		const reordered = reorderAnimationTo(animations, 2, 0);
		expect(reordered.map((animation) => animation.elementId)).toStrictEqual(['c', 'a', 'b']);
		expect(reordered.map((animation) => animation.order)).toStrictEqual([0, 1, 2]);
	});

	it('builds proportional duration and delay bars', () => {
		const bars = buildAnimationTimelineBars(animations);
		expect(bars[1]).toMatchObject({ elementId: 'b', leftPercent: 20, widthPercent: 80 });
	});

	it('offers unanimated active-slide elements as trigger shapes', () => {
		const elements = [
			{ id: 'selected', type: 'shape', x: 0, y: 0, width: 10, height: 10 },
			{ id: 'animated', type: 'shape', x: 0, y: 0, width: 10, height: 10 },
			{ id: 'not-animated', type: 'text', x: 0, y: 0, width: 10, height: 10 },
		] as never[];
		expect(
			getAnimationTriggerElements(elements, 'selected').map((element) => element.id),
		).toStrictEqual(['animated', 'not-animated']);
	});

	it('uses authored names and text for animation labels', () => {
		const named = { id: 'a', name: 'Named shape' } as PptxElement;
		const text = { id: 'b', type: 'text', text: 'Trigger text' } as PptxElement;
		expect(getAnimationElementLabel(named)).toBe('Named shape');
		expect(getAnimationElementLabel(text)).toBe('Trigger text');
	});

	describe('full-sequence reorder (editor-authored + deck-native anchors)', () => {
		const anchors = [{ order: 0, targetIds: ['native-1'], presetClasses: ['entr'] }] as const;

		it('merges editor rows and native anchors into one sorted timeline', () => {
			const editorOnly = [
				{ elementId: 'a', entrance: 'fadeIn', order: 1 },
			] as PptxElementAnimation[];
			const rows = buildAnimationTimelineRows(editorOnly, [...anchors]);
			expect(rows.map((row) => row.key)).toStrictEqual(['native:0', 'editor:a']);
		});

		it('moves an editor-authored effect ahead of a deck-native anchor via the move-up button', () => {
			const editorOnly = [
				{ elementId: 'a', entrance: 'fadeIn', order: 1 },
			] as PptxElementAnimation[];
			const moved = moveAnimationTimelineRowBy(editorOnly, [...anchors], 'a', -1);
			expect(moved[0]).toMatchObject({ elementId: 'a', order: 0 });
		});
	});
});
