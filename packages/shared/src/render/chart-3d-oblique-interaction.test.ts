// @vitest-environment jsdom
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ThreeViewContext, ThreeViewSceneEvent } from '../three-view/types';
import { buildChart3DSpecForElement } from './chart-3d-spec';
import type { Chart3DBarBox } from './chart-3d-spec';
import { buildObliqueCamera, mountChart3DView } from './chart-3d-view-scene';
import { CHART_INTERACTIVE_CLASS } from './chart-canvas-drag';

function barChart(chartData: Partial<PptxChartData> = {}): PptxElement {
	return {
		id: 'chart-1',
		type: 'chart',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		chartData: {
			chartType: 'bar3D',
			grouping: 'clustered',
			categories: ['Q1', 'Q2'],
			series: [{ name: 'Revenue', values: [100, 150] }],
			...chartData,
		},
	} as unknown as PptxElement;
}

interface Mounted {
	events: ThreeViewSceneEvent[];
	canvas: HTMLCanvasElement;
	boxes: readonly Chart3DBarBox[];
	svgWidth: number;
	svgHeight: number;
	requestRender: ReturnType<typeof vi.fn>;
	dispose: () => void;
	setInteractive: (on: boolean) => void;
}

const cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
	document.body.innerHTML = '';
});

/**
 * Mount the oblique scene on a canvas inside a `<pptx-three-view>`-like
 * shadow root, optionally under an ARMED chart root (the class a binding
 * toggles when the chart is selected and editable).
 */
async function mount(element: PptxElement, armed: boolean, interactive = true): Promise<Mounted> {
	const spec = buildChart3DSpecForElement(element);
	if (!spec || spec.geometry?.kind !== 'bar') {
		throw new Error('expected an oblique bar spec');
	}
	const root = document.createElement('div');
	if (armed) {
		root.classList.add(CHART_INTERACTIVE_CLASS);
	}
	const host = document.createElement('div');
	root.appendChild(host);
	document.body.appendChild(root);
	const shadow = host.attachShadow({ mode: 'open' });
	const canvas = document.createElement('canvas');
	const overlay = document.createElement('div');
	shadow.append(canvas, overlay);
	const { svgWidth, svgHeight } = spec.vm;
	canvas.getBoundingClientRect = () =>
		({ left: 0, top: 0, width: svgWidth, height: svgHeight }) as DOMRect;
	const events: ThreeViewSceneEvent[] = [];
	const requestRender = vi.fn();
	const ctx: ThreeViewContext = {
		three: THREE,
		OrbitControls: null,
		size: { width: svgWidth, height: svgHeight, pixelWidth: svgWidth, pixelHeight: svgHeight },
		eventTarget: canvas,
		overlay,
		document,
		interactive,
		requestRender,
		emit: (event) => events.push(event),
	};
	const scene = await mountChart3DView(spec, ctx);
	cleanups.push(() => scene.dispose());
	return {
		events,
		canvas,
		boxes: spec.geometry.boxes,
		svgWidth,
		svgHeight,
		requestRender,
		dispose: () => scene.dispose(),
		setInteractive: (on) => scene.setInteractive?.(on),
	};
}

/** Screen point at the middle of a box's front face (the front face is unsheared). */
function centerOf(box: Chart3DBarBox): { clientX: number; clientY: number } {
	return { clientX: box.x + box.w / 2, clientY: box.y + box.h / 2 };
}

function fire(target: Element, type: string, point: { clientX: number; clientY: number }): Event {
	const event = new MouseEvent(type, { ...point, bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

describe('oblique bar3D scene interaction', () => {
	it('selects the clicked box as a dataPoint part', async () => {
		const m = await mount(barChart(), true);
		const box = m.boxes[1];
		fire(m.canvas, 'pointerdown', centerOf(box));
		fire(m.canvas, 'pointerup', centerOf(box));
		expect(m.events).toStrictEqual([
			{ type: 'select', part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 1 } },
		]);
	});

	it('clears the selection when clicking empty space', async () => {
		const m = await mount(barChart(), true);
		const empty = { clientX: 2, clientY: 2 };
		fire(m.canvas, 'pointerdown', empty);
		fire(m.canvas, 'pointerup', empty);
		expect(m.events).toStrictEqual([{ type: 'select', part: null }]);
	});

	it('drags a clustered box value upward, previewing then committing once', async () => {
		const m = await mount(barChart(), true);
		const box = m.boxes[0];
		const start = centerOf(box);
		const end = { clientX: start.clientX, clientY: start.clientY - 40 };
		const down = fire(m.canvas, 'pointerdown', start);
		expect(down.defaultPrevented).toBeTruthy();
		fire(m.canvas, 'pointermove', end);
		fire(m.canvas, 'pointerup', end);
		const drags = m.events.filter((e) => e.type === 'drag');
		expect(drags).toHaveLength(2);
		const [move, commit] = drags as Array<Extract<ThreeViewSceneEvent, { type: 'drag' }>>;
		expect(move.detail.phase).toBe('move');
		expect(commit.detail.phase).toBe('commit');
		expect(commit.detail.part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 });
		expect(commit.detail.value).toBeGreaterThan(100);
		expect(m.events.some((e) => e.type === 'select')).toBeFalsy();
	});

	it('does not value-drag a stacked box (same rule as the 2D chart)', async () => {
		const m = await mount(
			barChart({
				grouping: 'stacked',
				series: [
					{ name: 'A', values: [1, 2] },
					{ name: 'B', values: [3, 4] },
				],
			} as Partial<PptxChartData>),
			true,
		);
		const start = centerOf(m.boxes[0]);
		fire(m.canvas, 'pointerdown', start);
		fire(m.canvas, 'pointermove', { clientX: start.clientX, clientY: start.clientY - 40 });
		fire(m.canvas, 'pointerup', { clientX: start.clientX, clientY: start.clientY - 40 });
		expect(m.events.filter((e) => e.type === 'drag')).toHaveLength(0);
	});

	it('an un-armed chart never drags, and the press is not claimed', async () => {
		const m = await mount(barChart(), false);
		const start = centerOf(m.boxes[0]);
		const down = fire(m.canvas, 'pointerdown', start);
		expect(down.defaultPrevented).toBeFalsy();
		fire(m.canvas, 'pointermove', { clientX: start.clientX, clientY: start.clientY - 40 });
		fire(m.canvas, 'pointerup', { clientX: start.clientX, clientY: start.clientY - 40 });
		expect(m.events.filter((e) => e.type === 'drag')).toHaveLength(0);
	});

	it('emits nothing while the view is not interactive', async () => {
		const m = await mount(barChart(), true, false);
		const box = m.boxes[0];
		fire(m.canvas, 'pointerdown', centerOf(box));
		fire(m.canvas, 'pointerup', centerOf(box));
		expect(m.events).toHaveLength(0);
		m.setInteractive(true);
		fire(m.canvas, 'pointerdown', centerOf(box));
		fire(m.canvas, 'pointerup', centerOf(box));
		expect(m.events).toHaveLength(1);
	});

	it('shows the hovered box as the canvas tooltip', async () => {
		const m = await mount(barChart(), false);
		fire(m.canvas, 'pointermove', centerOf(m.boxes[1]));
		expect(m.canvas.title).toBe('Revenue, Q2: 150');
		fire(m.canvas, 'pointermove', { clientX: 2, clientY: 2 });
		expect(m.canvas.title).toBe('');
	});

	it('picks the sheared top face above a box, not just its front face', async () => {
		const m = await mount(barChart(), true);
		const box = m.boxes[0];
		// Just above the front face's top edge, horizontally inside it: only the
		// extruded top face (sheared up-right by the depth vector) is there.
		const point = { clientX: box.x + box.w * 0.75, clientY: box.y - 1 };
		fire(m.canvas, 'pointerdown', point);
		fire(m.canvas, 'pointerup', point);
		expect(m.events).toStrictEqual([
			{ type: 'select', part: { role: 'dataPoint', seriesIndex: 0, pointIndex: 0 } },
		]);
	});
});

describe('buildObliqueCamera', () => {
	it('leaves the front plane (z = 0) exactly on the 2D layout', () => {
		const camera = buildObliqueCamera(THREE, 400, 300, 0.34, -0.26);
		camera.updateMatrixWorld();
		// SVG point (300, 50) -> world (100, 100, 0) -> NDC (0.5, 2/3).
		const p = new THREE.Vector3(100, 100, 0).project(camera);
		expect(p.x).toBeCloseTo(0.5, 9);
		expect(p.y).toBeCloseTo(2 / 3, 9);
	});

	it('shifts depth behind the front plane up and to the right by the shear', () => {
		const camera = buildObliqueCamera(THREE, 400, 300, 0.34, -0.26);
		camera.updateMatrixWorld();
		const front = new THREE.Vector3(0, 0, 0).project(camera);
		const back = new THREE.Vector3(0, 0, -10).project(camera);
		// 10 px of depth moves 0.34 * 10 px right and 0.26 * 10 px up (NDC = px / half-size).
		expect(back.x - front.x).toBeCloseTo((0.34 * 10) / 200, 9);
		expect(back.y - front.y).toBeCloseTo((0.26 * 10) / 150, 9);
	});
});
