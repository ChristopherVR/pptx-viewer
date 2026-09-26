import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { computePerspChartLayout } from './chart-3d-persp-layout';
import { buildPerspPrisms } from './chart-3d-persp-marks';
import { buildPrismGeometry } from './chart-3d-persp-mesh';
import { isShapedPerspPrism } from './chart-3d-persp-shape-mesh';
import { buildChartViewModel } from './chart-view-model-build';

function bars(chartData: Partial<PptxChartData> = {}): PptxElement {
	return {
		id: 'c',
		type: 'chart',
		x: 0,
		y: 0,
		width: 800,
		height: 450,
		chartData: {
			chartType: 'bar3D',
			grouping: 'clustered',
			categories: ['A', 'B'],
			series: [{ name: 'S1', values: [1, 2] }],
			view3D: { rotX: 15, rotY: 20, rAngAx: false },
			...chartData,
		},
	} as unknown as PptxElement;
}

function prismsOf(el: PptxElement) {
	const layout = computePerspChartLayout(el, buildChartViewModel(el));
	if (!layout || el.type !== 'chart' || !el.chartData) {
		throw new Error('expected a layout');
	}
	return buildPerspPrisms(el.chartData, layout);
}

describe('shaped bars without right-angle axes', () => {
	it('carries the chart c:shape and taper onto each bar', () => {
		const [bar] = prismsOf(bars({ barShape: 'cone' }));
		expect(bar.shape).toBe('cone');
		expect(bar.taper).toStrictEqual({ bottom: 1, top: 0 });
		expect(isShapedPerspPrism(bar)).toBeTruthy();
	});

	it('keeps a box bar an extrusion', () => {
		const [bar] = prismsOf(bars());
		expect(isShapedPerspPrism(bar)).toBeFalsy();
	});

	it('builds a round solid inside the bar footprint', () => {
		const [bar] = prismsOf(bars({ barShape: 'cylinder' }));
		const geometry = buildPrismGeometry(THREE, bar);
		geometry.computeBoundingBox();
		const box = geometry.boundingBox as THREE.Box3;
		const xs = bar.outline.map(([x]) => x);
		const ys = bar.outline.map(([, y]) => y);
		expect(box.min.x).toBeCloseTo(Math.min(...xs), 6);
		expect(box.max.x).toBeCloseTo(Math.max(...xs), 6);
		expect(box.min.y).toBeCloseTo(Math.min(...ys), 6);
		expect(box.max.y).toBeCloseTo(Math.max(...ys), 6);
		expect(box.min.z).toBeCloseTo(bar.z0, 6);
		expect(box.max.z).toBeCloseTo(bar.z1, 6);
		// A 48-segment cylinder, not a 6-face extruded box.
		expect(geometry.getAttribute('position').count).toBeGreaterThan(200);
		expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
	});

	it('points a cone at its value end along x for a horizontal chart', () => {
		const [bar] = prismsOf(bars({ barShape: 'cone', barDirection: 'bar' }));
		expect(bar.horizontal).toBeTruthy();
		const geometry = buildPrismGeometry(THREE, bar);
		const pos = geometry.getAttribute('position');
		const xs = bar.outline.map(([x]) => x);
		const tipX = Math.max(...xs);
		// Vertices at the value end (tip) collapse to the bar's centre line.
		const ys = bar.outline.map(([, y]) => y);
		const midY = (Math.min(...ys) + Math.max(...ys)) / 2;
		for (let i = 0; i < pos.count; i++) {
			if (Math.abs(pos.getX(i) - tipX) < 1e-9) {
				expect(pos.getY(i)).toBeCloseTo(midY, 6);
			}
		}
	});
});
