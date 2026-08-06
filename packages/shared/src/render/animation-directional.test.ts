import { describe, it, expect } from 'vitest';

import { buildDirectionalKeyframe } from './animation-directional';

/**
 * Direction ground truth comes from PowerPoint-authored XML (issue #132 deck),
 * where each directional effect carries BOTH the `presetSubtype` and an
 * explicit `p:animEffect/@filter` direction:
 *  - wipe subtype 1 <-> `wipe(up)`    (reveal grows from the BOTTOM edge)
 *  - wipe subtype 2 <-> `wipe(right)` (grows from the LEFT edge)
 *  - wipe subtype 4 <-> `wipe(down)`  (grows from the TOP edge)
 *  - wipe subtype 8 <-> `wipe(left)`  (grows from the RIGHT edge)
 *  - peek subtype 8 <-> `wipe(right)` (peek IN FROM THE LEFT: origin-edge code)
 *  - split subtype 21 <-> `barn(inVertical)`
 *
 * The reveals are CSS `mask` sweeps (not `clip-path`) so they compose with the
 * element's own geometry clip-path instead of replacing it.
 */
describe('buildDirectionalKeyframe', () => {
	it('returns undefined when no subtype is supplied (keep static preset)', () => {
		expect(buildDirectionalKeyframe('wipeIn', undefined, 0)).toBeUndefined();
	});

	it('returns undefined for a non-directional effect', () => {
		expect(buildDirectionalKeyframe('zoomIn', 8, 0)).toBeUndefined();
	});

	it('never animates clip-path (it would clobber the shape geometry clip)', () => {
		for (const subtype of [1, 2, 4, 8]) {
			const result = buildDirectionalKeyframe('wipeIn', subtype, 0);
			expect(result).toBeDefined();
			expect(result!.css).not.toContain('clip-path');
			expect(result!.css).toContain('mask-image');
		}
	});

	it('wipe subtype 1 (= wipe(up)) reveals from the BOTTOM edge', () => {
		const result = buildDirectionalKeyframe('wipeIn', 1, 3);
		expect(result).toBeDefined();
		expect(result!.keyframeName).toBe('pptx-tl-dir-3');
		// Bottom-edge reveal: vertical 2x mask, black at the bottom of the image,
		// position sweeping 0% -> 100%.
		expect(result!.css).toContain('linear-gradient(to top, #000 50%, transparent 50%)');
		expect(result!.css).toContain('mask-size: 100% 200%');
		expect(result!.css).toContain('from { mask-image: linear-gradient(to top');
		expect(result!.css).toContain('mask-position: 0% 0%; opacity: 1');
		expect(result!.css).toContain('mask-position: 0% 100%; opacity: 1');
	});

	it('wipe subtype 2 (= wipe(right)) reveals from the LEFT edge', () => {
		const result = buildDirectionalKeyframe('wipeIn', 2, 1);
		expect(result).toBeDefined();
		expect(result!.css).toContain('linear-gradient(to right, #000 50%, transparent 50%)');
		expect(result!.css).toContain('mask-position: 100% 0%');
		expect(result!.css).toContain('mask-position: 0% 0%');
	});

	it('wipe subtype 4 (= wipe(down)) reveals from the TOP edge', () => {
		const result = buildDirectionalKeyframe('wipeIn', 4, 1);
		expect(result).toBeDefined();
		expect(result!.css).toContain('linear-gradient(to bottom, #000 50%, transparent 50%)');
	});

	it('wipe subtype 8 (= wipe(left)) reveals from the RIGHT edge', () => {
		const result = buildDirectionalKeyframe('wipeIn', 8, 1);
		expect(result).toBeDefined();
		expect(result!.css).toContain('linear-gradient(to left, #000 50%, transparent 50%)');
	});

	it('collapses a wipe-out along the travel direction and ends transparent', () => {
		// Exit wipe subtype 4 = wipe(down): collapse toward the top edge.
		const result = buildDirectionalKeyframe('wipeOut', 4, 0);
		expect(result).toBeDefined();
		expect(result!.css).toContain('opacity: 0');
		expect(result!.css).toContain('linear-gradient(to bottom, #000 50%, transparent 50%)');
		// Reversed sweep: starts shown, ends hidden.
		expect(result!.css).toContain('from { mask-image');
	});

	it('peek uses the ORIGIN-edge encoding: subtype 8 reveals from the left', () => {
		const result = buildDirectionalKeyframe('peekIn', 8, 5);
		expect(result).toBeDefined();
		expect(result!.css).toContain('linear-gradient(to right, #000 50%, transparent 50%)');
	});

	it('split subtype 21 (= barn(inVertical)) closes two vertical doors inward', () => {
		const result = buildDirectionalKeyframe('splitIn', 21, 2);
		expect(result).toBeDefined();
		expect(result!.css).toContain('mask-position: left top, right top');
		expect(result!.css).toContain('mask-size: 0% 100%, 0% 100%');
		expect(result!.css).toContain('mask-size: 50.5% 100%, 50.5% 100%');
	});

	it('split subtype 26 (= barn(inHorizontal)) closes two horizontal doors inward', () => {
		const result = buildDirectionalKeyframe('splitIn', 26, 2);
		expect(result).toBeDefined();
		expect(result!.css).toContain('mask-position: left top, left bottom');
		expect(result!.css).toContain('mask-size: 100% 0%, 100% 0%');
	});

	it('split with an unknown subtype falls back to the static preset', () => {
		expect(buildDirectionalKeyframe('splitIn', 8, 2)).toBeUndefined();
	});
});
