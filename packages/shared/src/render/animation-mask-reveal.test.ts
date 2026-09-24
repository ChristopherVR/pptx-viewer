import { describe, expect, it } from 'vitest';

import {
	blindsDecl,
	checkerboardDecl,
	randomBarsBandDecl,
	wheelDecl,
} from './animation-mask-reveal';

describe('blindsDecl', () => {
	it('divides bands along the width for the vertical direction', () => {
		const decl = blindsDecl('vertical', 0.5);
		expect(decl).toContain('mask-repeat: repeat-x;');
		expect(decl).toContain('mask-size: 12.5000% 100%;');
		expect(decl).toContain('linear-gradient(to right,');
	});

	it('divides bands along the height for the horizontal direction', () => {
		const decl = blindsDecl('horizontal', 0.5);
		expect(decl).toContain('mask-repeat: repeat-y;');
		expect(decl).toContain('mask-size: 100% 12.5000%;');
		expect(decl).toContain('linear-gradient(to bottom,');
	});

	it('is fully closed at fraction 0 and fully open at fraction 1', () => {
		expect(blindsDecl('vertical', 0)).toContain('#000 0.000%, transparent 0.000%');
		expect(blindsDecl('vertical', 1)).toContain('#000 100.000%, transparent 100.000%');
	});

	it('clamps an out-of-range fraction', () => {
		expect(blindsDecl('vertical', -1)).toContain('#000 0.000%');
		expect(blindsDecl('vertical', 2)).toContain('#000 100.000%');
	});
});

describe('randomBarsBandDecl', () => {
	it('uses thinner (16-way) bands than blindsDecl (8-way)', () => {
		expect(randomBarsBandDecl('vertical', 0.5)).toContain('mask-size: 6.2500% 100%;');
		expect(randomBarsBandDecl('horizontal', 0.5)).toContain('mask-size: 100% 6.2500%;');
	});

	it('respects direction the same way blindsDecl does', () => {
		expect(randomBarsBandDecl('vertical', 0.5)).toContain('mask-repeat: repeat-x;');
		expect(randomBarsBandDecl('horizontal', 0.5)).toContain('mask-repeat: repeat-y;');
	});
});

describe('checkerboardDecl', () => {
	it('sweeps left-to-right for "across"', () => {
		const decl = checkerboardDecl('across', 0.5);
		expect(decl).toContain('linear-gradient(to right, #000 50.000%, transparent 50.000%)');
	});

	it('sweeps top-to-bottom for "down"', () => {
		const decl = checkerboardDecl('down', 0.5);
		expect(decl).toContain('linear-gradient(to bottom, #000 50.000%, transparent 50.000%)');
	});

	it('unions the two offset diagonal tiles into the checkerboard shape, then intersects the wipe', () => {
		const decl = checkerboardDecl('across', 1);
		expect(decl).toContain('mask-composite: add, intersect;');
		// Three layers: two identical diagonal tiles (the checkerboard) plus one directional wipe.
		expect(decl.match(/linear-gradient\(45deg,/g)).toHaveLength(2);
	});

	it('is fully hidden at fraction 0 (the wipe mask has zero opaque width)', () => {
		expect(checkerboardDecl('across', 0)).toContain('#000 0.000%, transparent 0.000%');
	});
});

describe('wheelDecl', () => {
	it('divides the reveal into the given number of spokes', () => {
		expect(wheelDecl(4, 0.5)).toContain('transparent 90.000deg');
		expect(wheelDecl(8, 0.5)).toContain('transparent 45.000deg');
	});

	it('is fully hidden at fraction 0 and fully shown at fraction 1', () => {
		expect(wheelDecl(4, 0)).toContain('#000 0deg, #000 0.000deg, transparent 0.000deg');
		expect(wheelDecl(4, 1)).toContain('#000 0deg, #000 90.000deg, transparent 90.000deg');
	});

	it('uses a repeating-conic-gradient so every spoke grows simultaneously', () => {
		expect(wheelDecl(3, 0.3)).toContain('repeating-conic-gradient(');
	});
});
