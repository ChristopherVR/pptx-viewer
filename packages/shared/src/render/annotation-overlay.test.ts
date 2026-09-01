import { describe, expect, it } from 'vitest';

import { buildStrokePathD, cursorForTool } from './annotation-overlay';

describe('buildStrokePathD', () => {
	it('returns an empty string for no points', () => {
		expect(buildStrokePathD([])).toBe('');
	});

	it('builds a single M command for one point', () => {
		expect(buildStrokePathD([{ x: 3, y: 4 }])).toBe('M 3 4');
	});

	it('builds M followed by L commands for a polyline', () => {
		expect(
			buildStrokePathD([
				{ x: 0, y: 0 },
				{ x: 10, y: 5 },
				{ x: 20, y: 15 },
			]),
		).toBe('M 0 0 L 10 5 L 20 15');
	});
});

describe('cursorForTool', () => {
	it('hides the native cursor for the laser tool', () => {
		expect(cursorForTool('laser')).toBe('none');
	});

	it('uses a crosshair for pen, highlighter, and eraser', () => {
		expect(cursorForTool('pen')).toBe('crosshair');
		expect(cursorForTool('highlighter')).toBe('crosshair');
		expect(cursorForTool('eraser')).toBe('crosshair');
	});

	it('falls back to the default cursor for "none"', () => {
		expect(cursorForTool('none')).toBe('default');
	});
});
