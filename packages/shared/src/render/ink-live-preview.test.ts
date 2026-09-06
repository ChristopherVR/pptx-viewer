import { describe, expect, it } from 'vitest';

import { buildLiveInkStrokeView } from './ink-live-preview';

describe('buildLiveInkStrokeView', () => {
	it('returns null for no points', () => {
		expect(buildLiveInkStrokeView({ points: [], color: '#000', width: 3, tool: 'pen' })).toBeNull();
	});

	it('draws a plain path for a single point (unlike a committed stroke, which requires two)', () => {
		const view = buildLiveInkStrokeView({
			points: [{ x: 5, y: 5 }],
			color: '#000',
			width: 3,
			tool: 'pen',
		});
		expect(view).not.toBeNull();
		expect(view?.d).toBe('M 5 5');
		expect(view?.nibMarks).toBeNull();
		expect(view?.circles).toBeNull();
	});

	it('renders a plain path when no point carries genuine pressure or tilt data', () => {
		const view = buildLiveInkStrokeView({
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
			],
			color: '#123456',
			width: 4,
			tool: 'pen',
		});
		expect(view).toStrictEqual({
			d: 'M 0 0 L 10 0',
			color: '#123456',
			width: 4,
			opacity: 1,
			circles: null,
			nibMarks: null,
		});
	});

	it('sets opacity 0.4 for a highlighter preview', () => {
		const view = buildLiveInkStrokeView({
			points: [
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
			],
			color: '#000',
			width: 4,
			tool: 'highlighter',
		});
		expect(view?.opacity).toBe(0.4);
	});

	it('renders calligraphic nib marks while the pointer reports a genuine tilt lean, matching the committed-stroke decision', () => {
		const view = buildLiveInkStrokeView({
			points: [
				{ x: 0, y: 0, tiltX: 0, tiltY: 0 },
				{ x: 10, y: 0, tiltX: 30, tiltY: -15 },
			],
			color: '#000',
			width: 4,
			tool: 'pen',
		});
		expect(view?.nibMarks).not.toBeNull();
		expect(view?.nibMarks).toHaveLength(2);
		expect(view?.circles).toBeNull();
	});

	it('renders pressure circles when tilt is absent but pressure genuinely varies', () => {
		const view = buildLiveInkStrokeView({
			points: [
				{ x: 0, y: 0, pressure: 0.1 },
				{ x: 10, y: 0, pressure: 0.9 },
			],
			color: '#000',
			width: 4,
			tool: 'pen',
		});
		expect(view?.circles).not.toBeNull();
		expect(view?.nibMarks).toBeNull();
	});

	it('a constant non-zero tilt across every point still authors nib marks (not a "no variation" degrade)', () => {
		const view = buildLiveInkStrokeView({
			points: [
				{ x: 0, y: 0, tiltX: 20, tiltY: 20 },
				{ x: 10, y: 0, tiltX: 20, tiltY: 20 },
			],
			color: '#000',
			width: 4,
			tool: 'pen',
		});
		expect(view?.nibMarks).not.toBeNull();
	});
});
