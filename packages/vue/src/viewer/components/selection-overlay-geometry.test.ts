/**
 * The overlay's placement maths, now that they are out of the SFC.
 *
 * These used to be closures inside `SelectionOverlay.vue`, reachable only by
 * mounting the component and reading style strings back off the DOM, which is
 * why two zoom bugs shipped here: handles that shrank with the stage zoom until
 * their hit area was a few px, and a rotate knob that sank underneath the N
 * handle at a mobile fit zoom. Both are one-line assertions once the maths are
 * plain functions.
 */
import { describe, expect, it } from 'vitest';

import {
	adjustHandleStyle,
	boxStyle,
	HANDLE_LIST,
	handleStyle,
	inverseZoom,
	payloadFromBox,
	rotateKnobStyle,
	rotateStemStyle,
	startBoxOf,
	stemLength,
} from './selection-overlay-geometry';
import type { SelectedBox } from './selection-overlay-geometry';

const box: SelectedBox = { id: 'el-1', x: 40, y: 80, width: 200, height: 100, rotation: 0 };

describe('selection overlay geometry', () => {
	it('renders all eight handles', () => {
		expect(HANDLE_LIST).toHaveLength(8);
		expect(HANDLE_LIST.map((meta) => meta.id)).toContain('nw');
	});

	it('places the box at its own coordinates and omits a zero rotation', () => {
		expect(boxStyle(box)).toStrictEqual({
			left: '40px',
			top: '80px',
			width: '200px',
			height: '100px',
			transform: 'none',
		});
	});

	it('rotates the box about its own centre when it carries a rotation', () => {
		expect(boxStyle({ ...box, rotation: 30 }).transform).toBe('rotate(30deg)');
	});

	it('places a handle at its fractional position within the box', () => {
		const se = HANDLE_LIST.find((meta) => meta.id === 'se')!;
		expect(handleStyle(se, box)).toStrictEqual({
			left: '200px',
			top: '100px',
			cursor: 'nwse-resize',
		});
	});

	it('grows the rotate stem as the stage zooms out, keeping it constant on screen', () => {
		// The overlay lives inside the scaled stage, so an element-px stem shrinks
		// with the zoom. At a mobile fit zoom the knob ended up ~7 screen px above
		// the box, underneath the N resize handle, which swallowed the press.
		expect(stemLength(1)).toBe(24);
		expect(stemLength(0.5)).toBe(48);
		expect(stemLength(0.3)).toBeCloseTo(80, 5);
	});

	it('treats a zero zoom as 1 rather than dividing by it', () => {
		expect(inverseZoom(0)).toBe(1);
		expect(stemLength(0)).toBe(24);
	});

	it('hangs the stem and the knob off the top centre of the box', () => {
		expect(rotateStemStyle(box, 0.5)).toStrictEqual({
			left: '100px',
			top: '-48px',
			height: '48px',
		});
		expect(rotateKnobStyle(box, 0.5)).toStrictEqual({ left: '100px', top: '-48px' });
	});

	// The descriptor point is where the diamond's CENTRE belongs (shared measures
	// it off the preset geometry), so the 10px handle is pulled back by half.
	// Left un-centred, every handle sat down-and-right of the feature it controls.
	it('centres the adjust handle on the descriptor point', () => {
		expect(adjustHandleStyle({ left: 12, top: 4, cursor: 'ns-resize' })).toStrictEqual({
			left: '7px',
			top: '-1px',
			cursor: 'ns-resize',
		});
	});

	it('falls back to a sane adjust handle when the shape has no descriptor', () => {
		expect(adjustHandleStyle(null)).toStrictEqual({
			left: '-5px',
			top: '-5px',
			cursor: 'ew-resize',
		});
	});

	it('defaults a missing rotation to 0 in both the payload and the start box', () => {
		const unrotated = { id: 'el-2', x: 1, y: 2, width: 3, height: 4 } as SelectedBox;
		expect(payloadFromBox('el-2', unrotated).rotation).toBe(0);
		expect(startBoxOf(unrotated).rotation).toBe(0);
	});
});
