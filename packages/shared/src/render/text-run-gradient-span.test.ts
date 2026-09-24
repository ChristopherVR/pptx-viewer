// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stitchContinuousGradientFill } from './text-run-gradient-span';
import type { RunStyle } from './text-run-style';

const GRADIENT = 'linear-gradient(90deg, #FF0000 0%, #0000FF 100%)';
const OTHER_GRADIENT = 'linear-gradient(90deg, #00FF00 0%, #FFFF00 100%)';

function run(text: string, style: RunStyle): { text: string; style: RunStyle } {
	return { text, style };
}

describe('stitchContinuousGradientFill', () => {
	// jsdom has no canvas 2D context by default (`getContext('2d')` returns
	// `null`), so a fake one is installed to give `measureWidth` a
	// deterministic width per run (one CSS px per character), the way a real
	// browser's `measureText` would for a monospace-ish stand-in.
	beforeEach(() => {
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
			font: '',
			measureText: (text: string) => ({ width: text.length * 10 }),
		} as unknown as CanvasRenderingContext2D);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('leaves a lone gradient run untouched (nothing to stitch)', () => {
		const runs = [run('Solo', { background: GRADIENT })];
		stitchContinuousGradientFill(runs);
		expect(runs[0].style.backgroundSize).toBeUndefined();
		expect(runs[0].style.backgroundPosition).toBeUndefined();
	});

	it('leaves runs with no background alone', () => {
		const runs = [run('Plain', {}), run('Text', {})];
		stitchContinuousGradientFill(runs);
		expect(runs[0].style.backgroundSize).toBeUndefined();
		expect(runs[1].style.backgroundSize).toBeUndefined();
	});

	// The motivating case: `p(r('GRADIENT ', grad) + r('SPANS RUNS', grad))`,
	// verified against PowerPoint through COM to paint as one continuous fill.
	it('sizes and offsets two adjacent runs sharing the identical gradient', () => {
		const runs = [
			run('GRADIENT ', { background: GRADIENT }),
			run('SPANS RUNS', { background: GRADIENT }),
		];
		stitchContinuousGradientFill(runs);
		// 'GRADIENT ' = 9 chars * 10px = 90px; 'SPANS RUNS' = 10 chars * 10px = 100px.
		expect(runs[0].style.backgroundSize).toBe('190px 100%');
		expect(runs[1].style.backgroundSize).toBe('190px 100%');
		expect(runs[0].style.backgroundPosition).toBe('-0px 0');
		expect(runs[1].style.backgroundPosition).toBe('-90px 0');
	});

	it('does not stitch runs with two DIFFERENT gradients', () => {
		const runs = [
			run('Red-Blue', { background: GRADIENT }),
			run('Green-Yellow', { background: OTHER_GRADIENT }),
		];
		stitchContinuousGradientFill(runs);
		expect(runs[0].style.backgroundSize).toBeUndefined();
		expect(runs[1].style.backgroundSize).toBeUndefined();
	});

	it('breaks the group at a plain (non-gradient) run in between', () => {
		const runs = [
			run('A', { background: GRADIENT }),
			run(' ', {}),
			run('B', { background: GRADIENT }),
		];
		stitchContinuousGradientFill(runs);
		// Each gradient run is now its own group of one: left as authored.
		expect(runs[0].style.backgroundSize).toBeUndefined();
		expect(runs[2].style.backgroundSize).toBeUndefined();
	});

	it('stitches a run of three or more matching runs together', () => {
		const runs = [
			run('AB', { background: GRADIENT }),
			run('CD', { background: GRADIENT }),
			run('EF', { background: GRADIENT }),
		];
		stitchContinuousGradientFill(runs);
		// 2 chars * 10px = 20px each, total 60px.
		expect(runs[0].style.backgroundSize).toBe('60px 100%');
		expect(runs[1].style.backgroundPosition).toBe('-20px 0');
		expect(runs[2].style.backgroundPosition).toBe('-40px 0');
	});
});
