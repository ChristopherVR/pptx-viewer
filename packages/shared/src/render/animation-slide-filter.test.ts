import { describe, expect, it } from 'vitest';

import { getInitialStyleForEffect } from './animation-effects';
import { getEffectKeyframes } from './animation-keyframes';
import { SLIDE_FEATHER, slideFrameAt } from './animation-slide-filter';
import type { SlideFromEdge } from './animation-slide-filter';

/** Parse a `12.345%` token. */
function num(value: string): number {
	return Number.parseFloat(value) / 100;
}

/**
 * Where the fully-opaque part of the window sits on the SLIDE (box units)
 * for a horizontal slide frame: the mask image is `3W` wide, placed at
 * `-(3 - 1) W * position` in element space, and the element itself is
 * translated by the frame's transform.
 */
function windowOnSlide(edge: SlideFromEdge, progress: number): [number, number] {
	const frame = slideFrameAt(edge, progress);
	const translate = num(/translate[XY]\((-?[\d.]+%)\)/.exec(frame.transform)![1]);
	const positions = frame.maskPosition.split(' ').map(num);
	const position = edge === 'Left' || edge === 'Right' ? positions[0] : positions[1];
	const offset = -2 * position;
	const stops = [...frame.maskImage.matchAll(/([\d.]+)%/g)].map((m) => num(`${m[1]}%`) * 3);
	const start = edge === 'Left' || edge === 'Top';
	// Opaque window [stops[1], stops[2]] in image units, mirrored for Right/Bottom.
	const lo = start ? stops[1] : 3 - stops[2];
	const hi = start ? stops[2] : 3 - stops[1];
	return [translate + offset + lo, translate + offset + hi];
}

describe('animation-slide-filter', () => {
	it.each(['Left', 'Right', 'Top', 'Bottom'] as SlideFromEdge[])(
		'%s: the opaque window stays fixed on the box while the content moves',
		(edge) => {
			for (const progress of [0, 0.3, 0.7, 1]) {
				const [lo, hi] = windowOnSlide(edge, progress);
				expect(lo).toBeCloseTo(0, 4);
				expect(hi).toBeCloseTo(1, 4);
			}
		},
	);

	it('starts the content a full box plus the ramp away and ends at rest', () => {
		expect(slideFrameAt('Left', 0).transform).toBe(
			`translateX(-${(100 * (1 + SLIDE_FEATHER)).toFixed(3)}%)`,
		);
		expect(slideFrameAt('Bottom', 0).transform).toBe(
			`translateY(${(100 * (1 + SLIDE_FEATHER)).toFixed(3)}%)`,
		);
		expect(slideFrameAt('Left', 1).transform).toBe('translateX(-0.000%)');
	});

	it('plays the exit as the entrance reversed and pre-seeds the hidden state', () => {
		const exit = getEffectKeyframes('slideOutLeft');
		expect(exit).toContain(`to { transform: ${slideFrameAt('Left', 0).transform}`);
		expect(getInitialStyleForEffect('slideInTop').transform).toBe(slideFrameAt('Top', 0).transform);
	});
});
