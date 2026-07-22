import { describe, it, expect } from 'vitest';

import { buildDirectionalKeyframe } from './animation-directional';

describe('buildDirectionalKeyframe', () => {
	it('returns undefined when no subtype is supplied (keep static preset)', () => {
		expect(buildDirectionalKeyframe('wipeIn', undefined, 0)).toBeUndefined();
	});

	it('returns undefined for a non-directional effect', () => {
		expect(buildDirectionalKeyframe('zoomIn', 8, 0)).toBeUndefined();
	});

	it('reveals a wipe from the top for the top origin edge (subtype 1)', () => {
		const result = buildDirectionalKeyframe('wipeIn', 1, 3);
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-tl-dir-3');
		// From-the-top reveal starts with the bottom clipped away.
		expect(result!.css).toContain('clip-path: inset(0 0 100% 0)');
		expect(result!.css).toContain('clip-path: inset(0 0 0 0)');
	});

	it('reveals a wipe from the right for the right origin edge (subtype 2)', () => {
		const result = buildDirectionalKeyframe('wipeIn', 2, 1);
		expect(result).toBeDefined();
		expect(result!.css).toContain('clip-path: inset(0 0 0 100%)');
	});

	it('collapses a wipe-out toward the exit edge and ends transparent', () => {
		const result = buildDirectionalKeyframe('wipeOut', 4, 0);
		expect(result).toBeDefined();
		expect(result!.css).toContain('opacity: 0');
		expect(result!.css).toContain('clip-path: inset(100% 0 0 0)');
	});

	it('opens a split vertically for a horizontal (left/right) origin edge', () => {
		const result = buildDirectionalKeyframe('splitIn', 8, 2);
		expect(result).toBeDefined();
		expect(result!.css).toContain('clip-path: inset(0 50% 0 50%)');
	});

	it('opens a split horizontally for a vertical (top/bottom) origin edge', () => {
		const result = buildDirectionalKeyframe('splitIn', 1, 2);
		expect(result).toBeDefined();
		expect(result!.css).toContain('clip-path: inset(50% 0 50% 0)');
	});
});
