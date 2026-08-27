import { describe, expect, it } from 'vitest';

import {
	applyPieTiltForeshortening,
	computePieTiltScale,
	squashSlicePathVertical,
} from './chart-pie3d-tilt';
import type { ChartViewModel, SvgLine, SvgPath, SvgText } from './chart-view-model';

describe('computePieTiltScale', () => {
	it('is 1 (no squash) at rotX = 0', () => {
		expect(computePieTiltScale({ rotX: 0 })).toBeCloseTo(1, 5);
	});

	it('shrinks the vertical radius as rotX grows, matching cos(rotX)', () => {
		expect(computePieTiltScale({ rotX: 30 })).toBeCloseTo(Math.cos(Math.PI / 6), 5);
		expect(computePieTiltScale({ rotX: 60 })).toBeCloseTo(Math.cos(Math.PI / 3), 5);
	});

	it('falls back to the default rotX (15deg) when view3D is absent', () => {
		expect(computePieTiltScale(undefined)).toBeCloseTo(Math.cos((15 * Math.PI) / 180), 5);
	});

	it('is symmetric in the sign of rotX', () => {
		expect(computePieTiltScale({ rotX: 30 })).toBeCloseTo(computePieTiltScale({ rotX: -30 }), 5);
	});

	it('clamps extreme rotX so the pie never collapses to a sliver', () => {
		const scale = computePieTiltScale({ rotX: 90 });
		expect(scale).toBeGreaterThanOrEqual(0.1);
		expect(scale).toBeLessThan(0.2);
	});

	it('never exceeds 1 (never stretches, only foreshortens)', () => {
		expect(computePieTiltScale({ rotX: 0 })).toBeLessThanOrEqual(1);
		expect(computePieTiltScale({ rotX: 5 })).toBeLessThanOrEqual(1);
	});
});

describe('squashSlicePathVertical', () => {
	it('scales M/L y-coordinates about cy, leaving x untouched', () => {
		const d = 'M100,100 L150,100 A50,50 0 0 1 100,150 Z';
		const out = squashSlicePathVertical(d, 100, 0.5);
		expect(out).toContain('M100,100');
		expect(out).toContain('L150,100');
	});

	it('squashes ry but leaves rx alone, turning a circular arc elliptical', () => {
		const d = 'M100,100 L150,100 A50,50 0 0 1 100,150 Z';
		const out = squashSlicePathVertical(d, 100, 0.5);
		// endpoint y=150 is 50 below cy=100, squashed by 0.5 -> 125.
		expect(out).toContain('A50,25,0,0,1,100,125');
	});

	it('leaves geometry unchanged at scaleY = 1', () => {
		const d = 'M100,100 L150,100 A50,50 0 0 1 100,150 Z';
		const out = squashSlicePathVertical(d, 100, 1);
		expect(out).toContain('A50,50,0,0,1,100,150');
	});

	it('preserves the Z terminator', () => {
		const d = 'M100,100 L150,100 A50,50 0 0 1 100,150 Z';
		expect(squashSlicePathVertical(d, 100, 0.5).endsWith('Z')).toBeTruthy();
	});
});

function emptyVm(overrides: Partial<ChartViewModel> = {}): ChartViewModel {
	return {
		svgWidth: 400,
		svgHeight: 300,
		title: undefined,
		titleX: 200,
		titleY: 14,
		gridlines: [],
		axisLabels: [],
		zeroLine: undefined,
		categoryLabels: [],
		primitives: [],
		dataLabels: [],
		legend: [],
		legendX: 200,
		legendY: 290,
		legendAnchor: 'middle',
		...overrides,
	};
}

describe('applyPieTiltForeshortening', () => {
	it('squashes slice paths, leader lines, and data label y-positions together', () => {
		const slice: SvgPath = {
			kind: 'path',
			d: 'M200,150 L250,150 A50,50 0 0 1 200,200 Z',
			fill: '#ED7D31',
		};
		const leaderLine: SvgLine = {
			kind: 'line',
			x1: 250,
			y1: 150,
			x2: 300,
			y2: 100,
			stroke: '#888',
			strokeWidth: 1,
		};
		const label: SvgText = {
			kind: 'text',
			x: 300,
			y: 100,
			text: '40%',
			fontSize: 10,
			fill: '#000',
			textAnchor: 'middle',
		};
		const vm = emptyVm({
			primitives: [slice, leaderLine],
			dataLabels: [label],
		});

		const tilted = applyPieTiltForeshortening(vm, 150, 0.5);

		const tiltedSlice = tilted.primitives.find((p): p is SvgPath => p.kind === 'path');
		expect(tiltedSlice?.d).toContain('A50,25,0,0,1,200,175');

		const tiltedLine = tilted.primitives.find((p): p is SvgLine => p.kind === 'line');
		// y1=150 is at cy (unchanged); y2=100 is 50 above cy, squashed to 25 above -> 125.
		expect(tiltedLine?.y1).toBeCloseTo(150, 5);
		expect(tiltedLine?.y2).toBeCloseTo(125, 5);
		expect(tiltedLine?.x1).toBe(250);
		expect(tiltedLine?.x2).toBe(300);

		const tiltedLabel = tilted.dataLabels[0];
		expect(tiltedLabel.y).toBeCloseTo(125, 5);
		expect(tiltedLabel.x).toBe(300);
	});

	it('is a no-op at scaleY = 1', () => {
		const slice: SvgPath = {
			kind: 'path',
			d: 'M200,150 L250,150 A50,50 0 0 1 200,200 Z',
			fill: '#ED7D31',
		};
		const vm = emptyVm({ primitives: [slice] });
		const tilted = applyPieTiltForeshortening(vm, 150, 1);
		const tiltedSlice = tilted.primitives.find((p): p is SvgPath => p.kind === 'path');
		expect(tiltedSlice?.d).toContain('A50,50,0,0,1,200,200');
	});
});
