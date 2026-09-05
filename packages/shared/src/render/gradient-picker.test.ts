import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	gradientStateFromStyle,
	gradientStatePatch,
	updateGradientStopPatch,
} from './gradient-picker';

const THEME_REF = { scheme: 'accent1' } as const;

function shapeElement(fillGradientStops: unknown): PptxElement {
	return {
		id: 'el-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeStyle: {
			fillMode: 'gradient',
			fillGradientType: 'linear',
			fillGradientAngle: 90,
			fillGradientStops,
		},
	} as unknown as PptxElement;
}

describe('gradientStateFromStyle', () => {
	it('carries a stop colorRef through sanitisation', () => {
		const state = gradientStateFromStyle({
			fillGradientType: 'linear',
			fillGradientAngle: 90,
			fillGradientStops: [
				{ color: '#4472c4', position: 0, colorRef: THEME_REF },
				{ color: '#ffffff', position: 100 },
			],
		});
		expect(state.stops[0]?.colorRef).toStrictEqual(THEME_REF);
		expect(state.stops[1]?.colorRef).toBeFalsy();
	});
});

describe('updateGradientStopPatch', () => {
	it('commits a theme colorRef onto the targeted stop only', () => {
		const el = shapeElement([
			{ color: '#4472c4', position: 0 },
			{ color: '#ffffff', position: 100 },
		]);
		const patch = updateGradientStopPatch(el, 0, { color: '#5b9bd5', colorRef: THEME_REF });
		const stops = (patch as { shapeStyle?: { fillGradientStops?: unknown[] } }).shapeStyle
			?.fillGradientStops as Array<{ color: string; colorRef?: unknown }>;
		expect(stops[0]?.color).toBe('#5b9bd5');
		expect(stops[0]?.colorRef).toStrictEqual(THEME_REF);
		expect(stops[1]?.colorRef).toBeFalsy();
	});

	it('clears a previously-stored ref on a custom colour commit', () => {
		const el = shapeElement([
			{ color: '#4472c4', position: 0, colorRef: THEME_REF },
			{ color: '#ffffff', position: 100 },
		]);
		const patch = updateGradientStopPatch(el, 0, { color: '#ff0000', colorRef: undefined });
		const stops = (patch as { shapeStyle?: { fillGradientStops?: unknown[] } }).shapeStyle
			?.fillGradientStops as Array<{ color: string; colorRef?: unknown }>;
		expect(stops[0]?.color).toBe('#ff0000');
		expect(stops[0]?.colorRef).toBeFalsy();
	});
});

describe('gradientStatePatch', () => {
	it('round-trips colorRef for every stop', () => {
		const el = shapeElement([]);
		const patch = gradientStatePatch(el, {
			type: 'linear',
			angle: 45,
			stops: [
				{ color: '#4472c4', position: 0, colorRef: THEME_REF },
				{ color: '#ffffff', position: 100 },
			],
		});
		const stops = (patch as { shapeStyle?: { fillGradientStops?: unknown[] } }).shapeStyle
			?.fillGradientStops as Array<{ colorRef?: unknown }>;
		expect(stops[0]?.colorRef).toStrictEqual(THEME_REF);
		expect(stops[1]?.colorRef).toBeFalsy();
	});
});
