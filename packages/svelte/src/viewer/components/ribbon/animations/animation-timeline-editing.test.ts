import type { PptxAnimationTimelineAnchor, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { reorderAnimationEntries } from './animation-timeline-editing';

describe('reorderAnimationEntries', () => {
	it('moves a dragged animation and rewrites stable order values', () => {
		const result = reorderAnimationEntries(
			[
				{ elementId: 'a', order: 4 },
				{ elementId: 'b', order: 8 },
				{ elementId: 'c', order: 9 },
			] as PptxElementAnimation[],
			[],
			'c',
			'editor:a',
		);
		expect(result.map((entry) => [entry.elementId, entry.order])).toStrictEqual([
			['c', 0],
			['a', 1],
			['b', 2],
		]);
	});

	it('moves an editor-authored entry ahead of a deck-native anchor', () => {
		const anchors = [
			{ order: 0, targetIds: ['native-1'], presetClasses: ['entr'] },
		] as PptxAnimationTimelineAnchor[];
		const entries = [{ elementId: 'a', order: 1 }] as PptxElementAnimation[];
		const result = reorderAnimationEntries(entries, anchors, 'a', 'native:0');
		expect(result[0]).toMatchObject({ elementId: 'a', order: 0 });
	});

	it('no-ops when the source id has no editor row', () => {
		const entries = [{ elementId: 'a', order: 0 }] as PptxElementAnimation[];
		const result = reorderAnimationEntries(entries, [], 'missing', 'editor:a');
		expect(result).toStrictEqual(entries);
	});
});
