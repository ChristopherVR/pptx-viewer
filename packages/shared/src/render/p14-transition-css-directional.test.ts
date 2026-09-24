import { describe, expect, it } from 'vitest';

import {
	getGlitterAnimations,
	getRippleAnimations,
	getVortexAnimations,
} from './p14-transition-css-directional';

const DUR = 700;
const EASE = 'ease-in-out';

describe('getVortexAnimations', () => {
	it('resolves all four COM-verified directions (l/u/r/d) to distinct keyframes', () => {
		const left = getVortexAnimations(DUR, 'l', EASE);
		const up = getVortexAnimations(DUR, 'u', EASE);
		const right = getVortexAnimations(DUR, 'r', EASE);
		const down = getVortexAnimations(DUR, 'd', EASE);
		expect(left.incoming).toContain('pptx-tr-vortex-in-left');
		expect(up.incoming).toContain('pptx-tr-vortex-in-up');
		expect(right.incoming).toContain('pptx-tr-vortex-in-right');
		expect(down.incoming).toContain('pptx-tr-vortex-in-down');
		const signatures = new Set([left, up, right, down].map((r) => `${r.outgoing}|${r.incoming}`));
		expect(signatures.size).toBe(4);
	});

	it('defaults to left when direction is unset (bare `<p14:vortex/>`, COM-verified)', () => {
		expect(getVortexAnimations(DUR, undefined, EASE)).toStrictEqual(
			getVortexAnimations(DUR, 'l', EASE),
		);
	});
});

describe('getRippleAnimations', () => {
	it('resolves the four COM-verified diagonal directions to distinct keyframes', () => {
		const lu = getRippleAnimations(DUR, 'lu', EASE);
		const ru = getRippleAnimations(DUR, 'ru', EASE);
		const ld = getRippleAnimations(DUR, 'ld', EASE);
		const rd = getRippleAnimations(DUR, 'rd', EASE);
		expect(lu.incoming).toContain('pptx-tr-ripple-in-lu');
		expect(ru.incoming).toContain('pptx-tr-ripple-in-ru');
		expect(ld.incoming).toContain('pptx-tr-ripple-in-ld');
		expect(rd.incoming).toContain('pptx-tr-ripple-in-rd');
	});

	it('falls back to the centre-origin keyframe when direction is unset (PowerPoint’s "From Center" default)', () => {
		const centre = getRippleAnimations(DUR, undefined, EASE);
		expect(centre.incoming).toBe(`pptx-tr-ripple-in ${DUR}ms ${EASE} forwards`);
	});
});

describe('getGlitterAnimations', () => {
	it('resolves all four cardinal directions to distinct keyframes for the default (diamond) pattern', () => {
		const left = getGlitterAnimations(DUR, 'l', undefined, EASE);
		const up = getGlitterAnimations(DUR, 'u', undefined, EASE);
		const right = getGlitterAnimations(DUR, 'r', undefined, EASE);
		const down = getGlitterAnimations(DUR, 'd', undefined, EASE);
		expect(left.incoming).toContain('pptx-tr-glitter-diamond-in-l');
		expect(up.incoming).toContain('pptx-tr-glitter-diamond-in-u');
		expect(right.incoming).toContain('pptx-tr-glitter-diamond-in-r');
		expect(down.incoming).toContain('pptx-tr-glitter-diamond-in-d');
	});

	it('switches keyframe family for the hexagon pattern (COM-verified `@pattern="hexagon"`)', () => {
		const diamond = getGlitterAnimations(DUR, 'l', 'diamond', EASE);
		const hexagon = getGlitterAnimations(DUR, 'l', 'hexagon', EASE);
		expect(diamond.incoming).toContain('pptx-tr-glitter-diamond-in-l');
		expect(hexagon.incoming).toContain('pptx-tr-glitter-hexagon-in-l');
		expect(hexagon.incoming).not.toBe(diamond.incoming);
	});

	it('always fades the outgoing layer (glitter has no distinct outgoing motion)', () => {
		const result = getGlitterAnimations(DUR, 'r', 'hexagon', EASE);
		expect(result.outgoing).toContain('pptx-tr-fade-out');
	});
});
