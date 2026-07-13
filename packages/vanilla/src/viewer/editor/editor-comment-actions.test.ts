import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { updateSlideComments } from './editor-comment-actions';

const slides: PptxSlide[] = [
	{ id: 's1', rId: 'r1', slideNumber: 1, elements: [], comments: [{ id: 'c1', text: 'Old' }] },
	{ id: 's2', rId: 'r2', slideNumber: 2, elements: [] },
];

describe('updateSlideComments', () => {
	it('updates only the requested slide and preserves other references', () => {
		const result = updateSlideComments(slides, 0, (comments) => [
			...comments,
			{ id: 'c2', text: 'New' },
		]);
		expect(result[0].comments?.map(({ id }) => id)).toStrictEqual(['c1', 'c2']);
		expect(result[1]).toBe(slides[1]);
	});

	it('supports edit, resolve, and deletion transforms', () => {
		const edited = updateSlideComments(slides, 0, (comments) =>
			comments.map((comment) => ({ ...comment, text: 'Edited', resolved: true })),
		);
		expect(edited[0].comments?.[0]).toMatchObject({ text: 'Edited', resolved: true });
		const removed = updateSlideComments(edited, 0, () => []);
		expect(removed[0].comments).toStrictEqual([]);
	});
});
