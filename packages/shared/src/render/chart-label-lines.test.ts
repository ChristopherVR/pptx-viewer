import { describe, expect, it } from 'vitest';

import { splitLabelLines } from './chart-label-lines';
import type { SvgText } from './chart-svg-primitives';

const base: SvgText = {
	kind: 'text',
	x: 50,
	y: 40,
	text: 'Cat 1\n25%',
	fontSize: 10,
	fill: '#000',
	textAnchor: 'middle',
	dominantBaseline: 'central',
};

describe('splitLabelLines', () => {
	it('returns a single-line label unchanged', () => {
		const one = { ...base, text: 'Cat 1' };
		expect(splitLabelLines(one)).toStrictEqual([one]);
	});

	it('stacks a centred label symmetrically about its y', () => {
		const lines = splitLabelLines(base);
		expect(lines.map((l) => l.text)).toStrictEqual(['Cat 1', '25%']);
		expect((lines[0]!.y + lines[1]!.y) / 2).toBeCloseTo(40);
		expect(lines[1]!.y).toBeGreaterThan(lines[0]!.y);
		expect(lines[0]!.x).toBe(50);
	});

	it('starts a baseline-anchored label at y and stacks downward', () => {
		const lines = splitLabelLines({ ...base, dominantBaseline: undefined });
		expect(lines[0]!.y).toBe(40);
		expect(lines[1]!.y).toBeGreaterThan(40);
	});
});
