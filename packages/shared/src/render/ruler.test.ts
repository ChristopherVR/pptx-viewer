import { describe, expect, it } from 'vitest';

import { generateTicks, PX_PER_INCH, RULER_THICKNESS, rulerDragToGuidePosition } from './ruler';

describe('generateTicks', () => {
	it('places a major numbered tick every inch at 1x scale', () => {
		const ticks = generateTicks(PX_PER_INCH * 10, 1, 'inches');
		const majors = ticks.filter((t) => t.label !== '');
		expect(majors.map((t) => t.label)).toStrictEqual([
			'0',
			'1',
			'2',
			'3',
			'4',
			'5',
			'6',
			'7',
			'8',
			'9',
			'10',
		]);
		const inch3 = majors.find((t) => t.label === '3');
		expect(inch3?.position).toBe(3 * PX_PER_INCH);
	});

	it('scales tick positions by the editor scale', () => {
		const ticks = generateTicks(PX_PER_INCH * 4, 0.5, 'inches');
		const inch2 = ticks.find((t) => t.label === '2');
		expect(inch2?.position).toBe(2 * PX_PER_INCH * 0.5);
	});

	it('emits minor ticks between the majors', () => {
		const ticks = generateTicks(PX_PER_INCH * 2, 1, 'inches');
		expect(ticks.some((t) => !t.isMajor)).toBeTruthy();
		expect(ticks.filter((t) => t.isMajor)).toHaveLength(3); // 0, 1, 2
	});

	it('exposes the ruler thickness constant', () => {
		expect(RULER_THICKNESS).toBe(20);
	});
});

describe('rulerDragToGuidePosition', () => {
	it('ignores a drag that never left the ruler strip', () => {
		expect(rulerDragToGuidePosition(RULER_THICKNESS, 1, 540)).toBeNull();
		expect(rulerDragToGuidePosition(4, 1, 540)).toBeNull();
	});

	it('un-scales the offset once the pointer is over the slide', () => {
		expect(rulerDragToGuidePosition(RULER_THICKNESS + 120, 1, 540)).toBe(120);
		expect(rulerDragToGuidePosition(RULER_THICKNESS + 120, 0.5, 540)).toBe(240);
	});

	it('discards a drop past the far edge of the slide', () => {
		expect(rulerDragToGuidePosition(RULER_THICKNESS + 600, 1, 540)).toBeNull();
	});

	it('treats a zero scale as 1x rather than dividing by zero', () => {
		expect(rulerDragToGuidePosition(RULER_THICKNESS + 30, 0, 540)).toBe(30);
	});
});
