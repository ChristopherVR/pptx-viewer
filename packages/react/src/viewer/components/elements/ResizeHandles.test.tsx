/**
 * React's handles must agree with the table the other four bindings read.
 *
 * React cannot import `RESIZE_HANDLE_GEOMETRY` into its markup the way Vue,
 * Svelte, Vanilla and Angular now do: it styles handles with Tailwind classes,
 * and Tailwind extracts class names statically, so a `cursor-${geometry.cursor}`
 * template is purged at build time and the handle ends up showing the default
 * arrow. The literals stay, and this spec is what stops them drifting from the
 * shared contract, which is the failure the extraction was meant to prevent
 * (a cursor pointing along the wrong diagonal looks fine in a screenshot and
 * wrong under the hand).
 */
import { RESIZE_HANDLE_GEOMETRY, RESIZE_HANDLES } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { CORNER_HANDLES, EDGE_HANDLES } from './ResizeHandles';

const ALL = [...CORNER_HANDLES, ...EDGE_HANDLES];

describe('resize handles', () => {
	it('renders every handle the shared contract defines, exactly once', () => {
		expect(ALL.map((entry) => entry.handle).sort()).toStrictEqual([...RESIZE_HANDLES].sort());
	});

	it.each(ALL)('gives $handle the shared cursor', ({ handle, cursor }) => {
		expect(cursor).toBe(`cursor-${RESIZE_HANDLE_GEOMETRY[handle].cursor}`);
	});

	it.each(ALL)('anchors $handle to the side its compass name names', ({ handle, posClass }) => {
		const { fx, fy } = RESIZE_HANDLE_GEOMETRY[handle];
		// Corners pin to a named edge pair; edge midpoints pin one axis and centre
		// the other, which Tailwind spells `left-1/2` / `top-1/2`.
		if (fx === 0) {
			expect(posClass).toMatch(/(^|\s|-)left-/u);
		} else if (fx === 1) {
			expect(posClass).toMatch(/(^|\s|-)right-/u);
		} else {
			expect(posClass).toContain('left-1/2');
		}

		if (fy === 0) {
			expect(posClass).toMatch(/(^|\s|-)top-/u);
		} else if (fy === 1) {
			expect(posClass).toMatch(/(^|\s|-)bottom-/u);
		} else {
			expect(posClass).toContain('top-1/2');
		}
	});
});
