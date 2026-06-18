import { describe, expect, it } from 'vitest';

import type { Guide } from './guides';
import { computeSnapToShape, SNAP_THRESHOLD } from './snap-shape';

const noGuides: Guide[] = [];

describe('computeSnapToShape', () => {
	const sibling = { id: 'sib', x: 100, y: 100, width: 200, height: 100 };

	it('snaps a left edge within threshold to a sibling left edge', () => {
		// Dragged box left at 103 → sibling left 100 (gap 3 < 6) snaps to 100.
		const r = computeSnapToShape(103, 400, 50, 50, [sibling], new Set(['drag']), noGuides);
		expect(r.x).toBe(100);
		expect(r.lines.some((l) => l.axis === 'v' && l.position === 100)).toBeTruthy();
	});

	it('does not snap beyond the threshold', () => {
		const r = computeSnapToShape(
			100 + SNAP_THRESHOLD + 5,
			400,
			50,
			50,
			[sibling],
			new Set(['drag']),
			noGuides,
		);
		expect(r.x).toBe(100 + SNAP_THRESHOLD + 5);
		expect(r.lines).toHaveLength(0);
	});

	it('ignores the dragged element itself', () => {
		const self = { id: 'drag', x: 100, y: 100, width: 200, height: 100 };
		const r = computeSnapToShape(102, 400, 50, 50, [self], new Set(['drag']), noGuides);
		expect(r.x).toBe(102);
	});

	it('snaps to a user guide position', () => {
		const guides: Guide[] = [{ id: 'g', axis: 'v', position: 300 }];
		// Dragged left at 298 → guide at 300 (gap 2) snaps left edge to 300.
		const r = computeSnapToShape(298, 400, 50, 50, [], new Set(['drag']), guides);
		expect(r.x).toBe(300);
		expect(r.lines.some((l) => l.axis === 'v' && l.position === 300)).toBeTruthy();
	});

	it('snaps centre-to-centre vertically', () => {
		// Sibling centre y = 150. Dragged height 50 → centre at y+25.
		// Place y so centre is 152 → snaps so centre = 150 → y = 125.
		const r = computeSnapToShape(400, 127, 50, 50, [sibling], new Set(['drag']), noGuides);
		expect(r.y).toBe(125);
	});
});
