import { describe, it, expect } from 'vitest';

import { buildInkStrokeView } from './ink-stroke-view';

const BASE = { path: 'M 0 0 L 10 10', color: '#000', width: 2 };

describe('buildInkStrokeView - blendMode', () => {
	it('is "normal" for a fully opaque stroke with no explicit tool flag', () => {
		const view = buildInkStrokeView({ ...BASE, opacity: 1 });
		expect(view.blendMode).toBe('normal');
	});

	it('is "multiply" for a translucent stroke with no explicit tool flag (a loaded contentPart highlighter)', () => {
		const view = buildInkStrokeView({ ...BASE, opacity: 0.4 });
		expect(view.blendMode).toBe('multiply');
	});

	it('is "normal" for a stroke explicitly flagged as not a highlighter, even if translucent', () => {
		const view = buildInkStrokeView({ ...BASE, opacity: 0.4, isHighlighter: false });
		expect(view.blendMode).toBe('normal');
	});

	it('is "multiply" for a stroke explicitly flagged as a highlighter, even at full opacity', () => {
		const view = buildInkStrokeView({ ...BASE, opacity: 1, isHighlighter: true });
		expect(view.blendMode).toBe('multiply');
	});

	it('treats opacity just under 1 (float round-trip noise) as still fully opaque', () => {
		const view = buildInkStrokeView({ ...BASE, opacity: 0.999 });
		expect(view.blendMode).toBe('normal');
	});

	it('applies the same blendMode regardless of render mode (pressure circles)', () => {
		const view = buildInkStrokeView({
			...BASE,
			opacity: 0.4,
			pressures: [0.1, 0.9],
		});
		expect(view.circles).not.toBeNull();
		expect(view.blendMode).toBe('multiply');
	});

	it('applies the same blendMode regardless of render mode (tilt nib marks)', () => {
		const view = buildInkStrokeView({
			...BASE,
			opacity: 0.4,
			tiltAngles: [0, Math.PI / 2],
			tiltMagnitudes: [0.2, 0.9],
		});
		expect(view.nibMarks).not.toBeNull();
		expect(view.blendMode).toBe('multiply');
	});
});
