/**
 * The eight resize handles are placed and cursored once, for all five bindings.
 *
 * Vue, Svelte, Vanilla, Angular and React each carried their own spelling of
 * this table (`HANDLE_META`, a `HANDLE_CURSORS`/`HANDLE_POSITIONS` pair, a
 * `switch` plus string matching, and Tailwind `cursor-*` classes). Five copies
 * of eight constants is five chances for one binding to hang a handle off the
 * wrong corner or point a resize cursor the wrong way, and nothing anywhere to
 * catch it: the overlay still looks plausible with `ne` and `nw` swapped.
 *
 * So the table is asserted against the meaning of the compass names rather than
 * transcribed, which is the only way this catches a copy-paste slip.
 */
import { describe, expect, it } from 'vitest';

import { RESIZE_HANDLE_GEOMETRY, RESIZE_HANDLES, ROTATE_STEM_PX } from './element-interaction';

describe('resize handle geometry', () => {
	it('covers every handle exactly once', () => {
		expect(Object.keys(RESIZE_HANDLE_GEOMETRY).sort()).toStrictEqual([...RESIZE_HANDLES].sort());
	});

	it.each([...RESIZE_HANDLES])('places %s where its compass name says', (handle) => {
		const { fx, fy } = RESIZE_HANDLE_GEOMETRY[handle];
		expect(fx).toBe(handle.includes('w') ? 0 : handle.includes('e') ? 1 : 0.5);
		expect(fy).toBe(handle.includes('n') ? 0 : handle.includes('s') ? 1 : 0.5);
	});

	it.each([...RESIZE_HANDLES])('gives %s the cursor its drag axis implies', (handle) => {
		const horizontal = handle.includes('e') || handle.includes('w');
		const vertical = handle.includes('n') || handle.includes('s');
		const expected =
			horizontal && vertical
				? // A corner: the cursor follows the diagonal it sits on. nw/se run
					// top-left to bottom-right (nwse); ne/sw run the other way.
					handle === 'nw' || handle === 'se'
					? 'nwse-resize'
					: 'nesw-resize'
				: horizontal
					? 'ew-resize'
					: 'ns-resize';
		expect(RESIZE_HANDLE_GEOMETRY[handle].cursor).toBe(expected);
	});

	it('puts opposite handles on opposite sides', () => {
		const opposites: ReadonlyArray<[string, string]> = [
			['nw', 'se'],
			['ne', 'sw'],
			['n', 's'],
			['e', 'w'],
		];
		for (const [a, b] of opposites) {
			const left = RESIZE_HANDLE_GEOMETRY[a as (typeof RESIZE_HANDLES)[number]];
			const right = RESIZE_HANDLE_GEOMETRY[b as (typeof RESIZE_HANDLES)[number]];
			expect(left.fx + right.fx).toBe(1);
			expect(left.fy + right.fy).toBe(1);
			// Opposite corners drag along the same diagonal, so they share a cursor.
			expect(left.cursor).toBe(right.cursor);
		}
	});

	it('keeps the rotate stem a screen-px constant', () => {
		// Divided by the zoom at every call site: a stem that scaled with the zoom
		// drifted away from the box, and at a mobile fit zoom of ~0.3 it put the
		// knob under the N handle where the press never reached it.
		expect(ROTATE_STEM_PX).toBe(24);
	});
});
