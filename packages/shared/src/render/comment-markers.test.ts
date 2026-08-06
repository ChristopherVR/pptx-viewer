import type { PptxComment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildCommentMarkers, COMMENT_MARKER_SIZE, commentMarkerTitle } from './comment-markers';

const comment = (overrides: Partial<PptxComment> = {}): PptxComment => ({
	id: 'c1',
	text: 'Check this',
	author: 'Alice',
	...overrides,
});

describe('commentMarkerTitle', () => {
	it('renders "<author>: <text>"', () => {
		expect(commentMarkerTitle(comment(), 'Unknown')).toBe('Alice: Check this');
	});

	it('falls back for missing and blank authors', () => {
		expect(commentMarkerTitle(comment({ author: undefined }), 'Unknown')).toBe(
			'Unknown: Check this',
		);
		expect(commentMarkerTitle(comment({ author: '' }), 'Unknown')).toBe('Unknown: Check this');
	});
});

describe('buildCommentMarkers', () => {
	it('numbers markers 1-based in comment order', () => {
		const markers = buildCommentMarkers(
			[comment(), comment({ id: 'c2', text: 'Second' })],
			960,
			540,
			'Unknown',
		);
		expect(markers.map((m) => m.label)).toStrictEqual(['1', '2']);
		expect(markers.map((m) => m.commentId)).toStrictEqual(['c1', 'c2']);
	});

	it('uses explicit x/y clamped to the slide', () => {
		const [marker] = buildCommentMarkers([comment({ x: 5000, y: -20 })], 960, 540, 'Unknown');
		expect(marker.x).toBe(952);
		expect(marker.y).toBe(8);
	});

	it('falls back to the 4-column grid when a comment has no position', () => {
		const markers = buildCommentMarkers(
			Array.from({ length: 5 }, (_, i) => comment({ id: `c${i}` })),
			960,
			540,
			'Unknown',
		);
		// First row: x advances by 14 per column.
		expect(markers[0]).toMatchObject({ x: 18, y: 18 });
		expect(markers[3]).toMatchObject({ x: 18 + 3 * 14, y: 18 });
		// Fifth marker wraps to the second row.
		expect(markers[4]).toMatchObject({ x: 18, y: 32 });
	});

	it('exposes the shared dot size', () => {
		expect(COMMENT_MARKER_SIZE).toBe(20);
	});
});
