import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
	buildPerspCamera,
	fitPerspView,
	perspBoxMatrix,
	perspCameraFor,
	perspScreenToPlaneY,
	perspToScreen,
} from './chart-3d-persp-view';

const camera = perspCameraFor({ w: 1, h: 0.353, d: 0.68 }, 15, 20);

describe('perspective chart view', () => {
	it('reproduces gt/chart-10 (a 4 x 3 line chart) to within a few pt', () => {
		// Frame (60, 40) 840 x 460 pt; region fitted as in the layout.
		const view = fitPerspView(perspCameraFor({ w: 1, h: 0.357, d: 0.72 }, 15, 20), {
			left: 108,
			top: 88,
			right: 840,
			bottom: 438.5,
		});
		const near = (p: { x: number; y: number }, x: number, y: number): void => {
			expect(Math.abs(p.x - x)).toBeLessThan(8);
			expect(Math.abs(p.y - y)).toBeLessThan(8);
		};
		near(perspToScreen(view, [0, 0, 0]), 139, 361.5);
		near(perspToScreen(view, [0, 0.357, 0]), 125, 147);
		near(perspToScreen(view, [0, 0.357, 0.72]), 328, 88);
		near(perspToScreen(view, [1, 0.357, 0.72]), 817, 112.5);
		near(perspToScreen(view, [1, 0, 0]), 745, 438.5);
	});

	it('converges vertical edges downward (the camera looks down)', () => {
		const view = fitPerspView(camera, { left: 100, top: 90, right: 850, bottom: 440 });
		const bottom = perspToScreen(view, [0, 0, 0]);
		const top = perspToScreen(view, [0, view.box.h, 0]);
		expect(top.x).toBeLessThan(bottom.x);
	});

	it('brings the right end toward the viewer and the back up', () => {
		const view = fitPerspView(camera, { left: 100, top: 90, right: 850, bottom: 440 });
		const frontLeft = perspToScreen(view, [0, 0, 0]);
		const frontRight = perspToScreen(view, [1, 0, 0]);
		const backLeft = perspToScreen(view, [0, 0, view.box.d]);
		expect(frontRight.y).toBeGreaterThan(frontLeft.y);
		expect(backLeft.y).toBeLessThan(frontLeft.y);
		expect(backLeft.x).toBeGreaterThan(frontLeft.x);
	});

	it('fills the rect in its limiting dimension and sits on its bottom', () => {
		const rect = { left: 100, top: 90, right: 850, bottom: 440 };
		const view = fitPerspView(camera, rect);
		const pts = [0, 1].flatMap((i) =>
			[0, 1].flatMap((j) =>
				[0, 1].map((k) => perspToScreen(view, [i, j * view.box.h, k * view.box.d])),
			),
		);
		const minX = Math.min(...pts.map((p) => p.x));
		const maxX = Math.max(...pts.map((p) => p.x));
		const minY = Math.min(...pts.map((p) => p.y));
		const maxY = Math.max(...pts.map((p) => p.y));
		expect(maxY).toBeCloseTo(rect.bottom, 6);
		expect(minX - rect.left).toBeCloseTo(rect.right - maxX, 6);
		const fillsW = Math.abs(maxX - minX - (rect.right - rect.left)) < 1e-6;
		const fillsH = Math.abs(maxY - minY - (rect.bottom - rect.top)) < 1e-6;
		expect(fillsW || fillsH).toBeTruthy();
	});

	it('the three.js camera projects box space exactly as perspToScreen', () => {
		const view = fitPerspView(camera, { left: 100, top: 90, right: 850, bottom: 440 });
		const W = 1120;
		const H = 613;
		const cam = buildPerspCamera(THREE, view, W, H);
		const box = perspBoxMatrix(THREE, view);
		for (const p of [
			[0, 0, 0],
			[1, 0.353, 0.68],
			[0.3, 0.1, 0.5],
		] as const) {
			const v = new THREE.Vector3(...p).applyMatrix4(box).applyMatrix4(cam.projectionMatrix);
			const sx = ((v.x + 1) / 2) * W;
			const sy = ((1 - v.y) / 2) * H;
			const want = perspToScreen(view, p);
			expect(sx).toBeCloseTo(want.x, 6);
			expect(sy).toBeCloseTo(want.y, 6);
			expect(Math.abs(v.z)).toBeLessThan(1);
		}
	});
});

describe('perspScreenToPlaneY', () => {
	it('inverts perspToScreen on a horizontal plane', () => {
		const view = fitPerspView(perspCameraFor({ w: 2, h: 0.46, d: 2 }, 30, 10), {
			left: 100,
			top: 60,
			right: 900,
			bottom: 500,
		});
		for (const [x, z] of [
			[1, 1],
			[0.2, 1.7],
			[1.9, 0.1],
		]) {
			const at = perspToScreen(view, [x, 0.46, z]);
			const hit = perspScreenToPlaneY(view, at.x, at.y, 0.46);
			expect(hit?.x).toBeCloseTo(x, 6);
			expect(hit?.z).toBeCloseTo(z, 6);
		}
	});
});
