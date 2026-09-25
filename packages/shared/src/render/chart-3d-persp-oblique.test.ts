import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { perspObliqueCameraFor } from './chart-3d-persp-oblique';
import {
	buildPerspCamera,
	fitPerspView,
	perspBoxMatrix,
	perspToScreen,
} from './chart-3d-persp-view';
import { buildChart3DSpecForElement } from './chart-3d-spec';

const view = fitPerspView(perspObliqueCameraFor({ w: 1, h: 0.36, d: 0.5 }, 15, 20), {
	left: 100,
	top: 80,
	right: 1000,
	bottom: 520,
});

describe('oblique perspective box (right-angle axes)', () => {
	it('draws the front plane flat and shears depth up and to the right', () => {
		const fl = perspToScreen(view, [0, 0, 0]);
		const ft = perspToScreen(view, [0, 0.36, 0]);
		const fr = perspToScreen(view, [1, 0, 0]);
		const bl = perspToScreen(view, [0, 0, 0.5]);
		expect(ft.x).toBeCloseTo(fl.x, 9);
		expect(fr.y).toBeCloseTo(fl.y, 9);
		expect((fr.x - fl.x) / (fl.y - ft.y)).toBeCloseTo(1 / 0.36, 9);
		expect(bl.x - fl.x).toBeCloseTo(0.5 * view.focal * Math.sin(Math.PI / 9), 6);
		expect(fl.y - bl.y).toBeCloseTo(0.5 * view.focal * Math.sin(Math.PI / 12), 6);
	});

	it('the three.js camera projects box space exactly as perspToScreen, nearer in front', () => {
		const W = 1120;
		const H = 613;
		const cam = buildPerspCamera(THREE, view, W, H);
		const box = perspBoxMatrix(THREE, view);
		const ndc = (p: readonly [number, number, number]) =>
			new THREE.Vector3(...p).applyMatrix4(box).applyMatrix4(cam.projectionMatrix);
		for (const p of [
			[0, 0, 0],
			[1, 0.36, 0.5],
			[0.3, 0.1, 0.2],
		] as const) {
			const v = ndc(p);
			const want = perspToScreen(view, p);
			expect(((v.x + 1) / 2) * W).toBeCloseTo(want.x, 6);
			expect(((1 - v.y) / 2) * H).toBeCloseTo(want.y, 6);
			expect(Math.abs(v.z)).toBeLessThan(1);
		}
		expect(ndc([0.5, 0.1, 0]).z).toBeLessThan(ndc([0.5, 0.1, 0.5]).z);
	});

	it('routes right-angle-axes line and area charts to the oblique box', () => {
		for (const chartType of ['line3D', 'area3D'] as const) {
			const spec = buildChart3DSpecForElement({
				id: 'c',
				type: 'chart',
				x: 0,
				y: 0,
				width: 800,
				height: 450,
				chartData: {
					chartType,
					categories: ['A', 'B'],
					series: [{ name: 'S', values: [1, 2] }],
					view3D: { rotX: 15, rotY: 20, rAngAx: true },
				} as PptxChartData,
			} as unknown as PptxElement);
			expect(spec?.geometry?.kind).toBe('perspective');
			expect(spec?.perspective).toBeNull();
			if (spec?.geometry?.kind === 'perspective') {
				expect(spec.geometry.layout.view.oblique).toBeDefined();
			}
		}
	});
});
