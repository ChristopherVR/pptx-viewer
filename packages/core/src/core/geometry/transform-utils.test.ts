import { describe, it, expect } from 'vitest';

import type { PptxElement } from '../types';
import { getElementTransform, getTextCompensationTransform } from './transform-utils';

/**
 * Comprehensive tests for transform-utils.ts
 *
 * These functions build CSS `transform` strings from PptxElement properties:
 * - getElementTransform: combines flipH, flipV, and rotation
 * - getTextCompensationTransform: only flipH/flipV (to un-mirror text)
 */

// Helper: create a minimal PptxElement with optional overrides
function makeElement(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'el-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as unknown as PptxElement;
}

// ---------------------------------------------------------------------------
// getElementTransform
// ---------------------------------------------------------------------------

describe('getElementTransform', () => {
	// -- No transforms --

	it('returns undefined when element has no flip or rotation properties', () => {
		const el = makeElement();
		expect(getElementTransform(el)).toBeUndefined();
	});

	it('returns undefined when flipHorizontal is false, flipVertical is false, and rotation is undefined', () => {
		const el = makeElement({
			flipHorizontal: false,
			flipVertical: false,
			rotation: undefined,
		});
		expect(getElementTransform(el)).toBeUndefined();
	});

	it('returns undefined when rotation is 0 (falsy)', () => {
		const el = makeElement({ rotation: 0 });
		expect(getElementTransform(el)).toBeUndefined();
	});

	// -- Single transforms --

	it('returns scaleX(-1) for flipHorizontal only', () => {
		const el = makeElement({ flipHorizontal: true });
		expect(getElementTransform(el)).toBe('scaleX(-1)');
	});

	it('returns scaleY(-1) for flipVertical only', () => {
		const el = makeElement({ flipVertical: true });
		expect(getElementTransform(el)).toBe('scaleY(-1)');
	});

	it('returns rotate(Ndeg) for rotation only', () => {
		const el = makeElement({ rotation: 90 });
		expect(getElementTransform(el)).toBe('rotate(90deg)');
	});

	// -- Common rotation angles --

	it('handles 45-degree rotation', () => {
		const el = makeElement({ rotation: 45 });
		expect(getElementTransform(el)).toBe('rotate(45deg)');
	});

	it('handles 180-degree rotation', () => {
		const el = makeElement({ rotation: 180 });
		expect(getElementTransform(el)).toBe('rotate(180deg)');
	});

	it('handles 270-degree rotation', () => {
		const el = makeElement({ rotation: 270 });
		expect(getElementTransform(el)).toBe('rotate(270deg)');
	});

	it('handles 360-degree rotation', () => {
		const el = makeElement({ rotation: 360 });
		expect(getElementTransform(el)).toBe('rotate(360deg)');
	});

	// -- Fractional and negative rotations --

	it('handles fractional rotation (e.g. 22.5 degrees)', () => {
		const el = makeElement({ rotation: 22.5 });
		expect(getElementTransform(el)).toBe('rotate(22.5deg)');
	});

	it('handles negative rotation', () => {
		const el = makeElement({ rotation: -45 });
		expect(getElementTransform(el)).toBe('rotate(-45deg)');
	});

	it('handles very small positive rotation', () => {
		const el = makeElement({ rotation: 0.01 });
		expect(getElementTransform(el)).toBe('rotate(0.01deg)');
	});

	// -- Pair combinations --

	it('combines flipHorizontal and flipVertical', () => {
		const el = makeElement({ flipHorizontal: true, flipVertical: true });
		expect(getElementTransform(el)).toBe('scaleX(-1) scaleY(-1)');
	});

	it('combines flipHorizontal and rotation', () => {
		const el = makeElement({ flipHorizontal: true, rotation: 90 });
		expect(getElementTransform(el)).toBe('rotate(90deg) scaleX(-1)');
	});

	it('combines flipVertical and rotation', () => {
		const el = makeElement({ flipVertical: true, rotation: 45 });
		expect(getElementTransform(el)).toBe('rotate(45deg) scaleY(-1)');
	});

	// -- All three transforms --

	it('combines flipH, flipV, and rotation in correct order', () => {
		const el = makeElement({
			flipHorizontal: true,
			flipVertical: true,
			rotation: 90,
		});
		expect(getElementTransform(el)).toBe('rotate(90deg) scaleX(-1) scaleY(-1)');
	});

	it('applies order: rotation before flipH before flipV', () => {
		// Verifying the OOXML-correct order: rotation, flipH, flipV
		const el = makeElement({
			flipHorizontal: true,
			flipVertical: true,
			rotation: 270,
		});
		const result = getElementTransform(el)!;
		const parts = result.split(' ');
		expect(parts).toHaveLength(3);
		expect(parts[0]).toBe('rotate(270deg)');
		expect(parts[1]).toBe('scaleX(-1)');
		expect(parts[2]).toBe('scaleY(-1)');
	});

	// -- Falsy values that should not produce transforms --

	it('does not include flipHorizontal when false', () => {
		const el = makeElement({ flipHorizontal: false, rotation: 30 });
		expect(getElementTransform(el)).toBe('rotate(30deg)');
	});

	it('does not include flipVertical when false', () => {
		const el = makeElement({ flipVertical: false, rotation: 60 });
		expect(getElementTransform(el)).toBe('rotate(60deg)');
	});

	// -- Different element types --

	it('works with image element type', () => {
		const el = makeElement({ type: 'image', flipHorizontal: true });
		expect(getElementTransform(el)).toBe('scaleX(-1)');
	});

	it('works with text element type', () => {
		const el = makeElement({ type: 'text', rotation: 90 });
		expect(getElementTransform(el)).toBe('rotate(90deg)');
	});

	it('works with connector element type', () => {
		const el = makeElement({
			type: 'connector',
			flipVertical: true,
			rotation: 180,
		});
		expect(getElementTransform(el)).toBe('rotate(180deg) scaleY(-1)');
	});

	it('works with group element type', () => {
		const el = makeElement({
			type: 'group',
			flipHorizontal: true,
			flipVertical: true,
		});
		expect(getElementTransform(el)).toBe('scaleX(-1) scaleY(-1)');
	});
});

// ---------------------------------------------------------------------------
// getTextCompensationTransform
// ---------------------------------------------------------------------------

describe('getTextCompensationTransform', () => {
	// -- No transforms --

	it('returns undefined when element has no flip properties', () => {
		const el = makeElement();
		expect(getTextCompensationTransform(el)).toBeUndefined();
	});

	it('returns undefined when both flips are false', () => {
		const el = makeElement({
			flipHorizontal: false,
			flipVertical: false,
		});
		expect(getTextCompensationTransform(el)).toBeUndefined();
	});

	it('returns undefined when only rotation is set (no flips)', () => {
		const el = makeElement({ rotation: 90 });
		expect(getTextCompensationTransform(el)).toBeUndefined();
	});

	it('returns undefined when rotation is set but no flips', () => {
		const el = makeElement({ rotation: 270 });
		expect(getTextCompensationTransform(el)).toBeUndefined();
	});

	// -- Single flip transforms --

	it('returns scaleX(-1) for flipHorizontal only', () => {
		const el = makeElement({ flipHorizontal: true });
		expect(getTextCompensationTransform(el)).toBe('scaleX(-1)');
	});

	it('returns scaleY(-1) for flipVertical only', () => {
		const el = makeElement({ flipVertical: true });
		expect(getTextCompensationTransform(el)).toBe('scaleY(-1)');
	});

	// -- Both flips --

	it('combines flipHorizontal and flipVertical', () => {
		const el = makeElement({ flipHorizontal: true, flipVertical: true });
		expect(getTextCompensationTransform(el)).toBe('scaleX(-1) scaleY(-1)');
	});

	// -- Rotation is explicitly ignored --

	it('ignores rotation when flipHorizontal is set', () => {
		const el = makeElement({ flipHorizontal: true, rotation: 45 });
		expect(getTextCompensationTransform(el)).toBe('scaleX(-1)');
	});

	it('ignores rotation when flipVertical is set', () => {
		const el = makeElement({ flipVertical: true, rotation: 90 });
		expect(getTextCompensationTransform(el)).toBe('scaleY(-1)');
	});

	it('ignores rotation when both flips are set', () => {
		const el = makeElement({
			flipHorizontal: true,
			flipVertical: true,
			rotation: 180,
		});
		expect(getTextCompensationTransform(el)).toBe('scaleX(-1) scaleY(-1)');
	});

	it('ignores negative rotation', () => {
		const el = makeElement({ flipHorizontal: true, rotation: -90 });
		expect(getTextCompensationTransform(el)).toBe('scaleX(-1)');
	});

	// -- Order verification --

	it('applies flipH before flipV in the output string', () => {
		const el = makeElement({ flipHorizontal: true, flipVertical: true });
		const result = getTextCompensationTransform(el)!;
		const parts = result.split(' ');
		expect(parts).toHaveLength(2);
		expect(parts[0]).toBe('scaleX(-1)');
		expect(parts[1]).toBe('scaleY(-1)');
	});

	// -- Falsy flip values --

	it('does not include flipHorizontal when explicitly false', () => {
		const el = makeElement({ flipHorizontal: false, flipVertical: true });
		expect(getTextCompensationTransform(el)).toBe('scaleY(-1)');
	});

	it('does not include flipVertical when explicitly false', () => {
		const el = makeElement({ flipHorizontal: true, flipVertical: false });
		expect(getTextCompensationTransform(el)).toBe('scaleX(-1)');
	});
});

// ---------------------------------------------------------------------------
// Relationship between getElementTransform and getTextCompensationTransform
// ---------------------------------------------------------------------------

describe('getElementTransform vs getTextCompensationTransform relationship', () => {
	it('both produce identical output when only flips are present (no rotation)', () => {
		const el = makeElement({ flipHorizontal: true, flipVertical: true });
		expect(getElementTransform(el)).toBe(getTextCompensationTransform(el));
	});

	it('element transform includes rotation while text compensation does not', () => {
		const el = makeElement({
			flipHorizontal: true,
			flipVertical: true,
			rotation: 90,
		});
		const elementT = getElementTransform(el)!;
		const textT = getTextCompensationTransform(el)!;

		expect(elementT).toContain('rotate(90deg)');
		expect(textT).not.toContain('rotate');
	});

	it('both return undefined for a plain element with no transforms', () => {
		const el = makeElement();
		expect(getElementTransform(el)).toBeUndefined();
		expect(getTextCompensationTransform(el)).toBeUndefined();
	});

	it('text compensation is undefined when element transform is rotation-only', () => {
		const el = makeElement({ rotation: 45 });
		expect(getElementTransform(el)).toBe('rotate(45deg)');
		expect(getTextCompensationTransform(el)).toBeUndefined();
	});

	it('text compensation matches the flip portion of element transform', () => {
		const el = makeElement({
			flipHorizontal: true,
			rotation: 120,
		});
		const elementT = getElementTransform(el)!;
		const textT = getTextCompensationTransform(el)!;

		// Element transform is rotation followed by the flip (OOXML order).
		expect(elementT).toBe('rotate(120deg) scaleX(-1)');
		// Text compensation should only have the flip
		expect(textT).toBe('scaleX(-1)');
		// The flip portion is present in the element transform
		expect(elementT.includes(textT)).toBeTruthy();
	});
});
