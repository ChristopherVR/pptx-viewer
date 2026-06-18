import { describe, expect, it } from 'vitest';

import { createGuide, moveGuide, removeGuide } from './guides';

const canvas = { width: 960, height: 540 };

describe('guides', () => {
	it('createGuide centres a horizontal guide on slide height', () => {
		expect(createGuide('g1', 'h', canvas)).toStrictEqual({ id: 'g1', axis: 'h', position: 270 });
	});

	it('createGuide centres a vertical guide on slide width', () => {
		expect(createGuide('g2', 'v', canvas)).toStrictEqual({ id: 'g2', axis: 'v', position: 480 });
	});

	it('moveGuide updates only the matching guide', () => {
		const guides = [createGuide('g1', 'h', canvas), createGuide('g2', 'v', canvas)];
		const next = moveGuide(guides, 'g1', 100, canvas);
		expect(next[0].position).toBe(100);
		expect(next[1].position).toBe(480);
	});

	it('moveGuide clamps to slide bounds per axis', () => {
		const guides = [createGuide('h', 'h', canvas), createGuide('v', 'v', canvas)];
		expect(moveGuide(guides, 'h', 9999, canvas)[0].position).toBe(540);
		expect(moveGuide(guides, 'h', -50, canvas)[0].position).toBe(0);
		expect(moveGuide(guides, 'v', 9999, canvas)[1].position).toBe(960);
	});

	it('removeGuide drops the matching guide', () => {
		const guides = [createGuide('g1', 'h', canvas), createGuide('g2', 'v', canvas)];
		expect(removeGuide(guides, 'g1')).toStrictEqual([guides[1]]);
	});
});
