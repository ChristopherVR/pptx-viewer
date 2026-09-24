// @vitest-environment jsdom
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { ThreeOrbitControls, ThreeViewContext } from '../three-view/types';
import {
	createHostedChart3DStage,
	finishHostedChart3DScene,
	hostedChart3DInteraction,
} from './chart-3d-hosted-stage';
import { CHART_INTERACTIVE_CLASS, isChartInteractionArmed } from './chart-canvas-drag';

function fakeCtx(interactive: boolean, orbit?: ThreeViewContext['OrbitControls']) {
	const canvas = document.createElement('canvas');
	const ctx: ThreeViewContext = {
		three: THREE,
		OrbitControls: orbit ?? null,
		size: { width: 200, height: 100, pixelWidth: 200, pixelHeight: 100 },
		eventTarget: canvas,
		overlay: document.createElement('div'),
		document,
		interactive,
		requestRender: vi.fn(),
		emit: vi.fn(),
	};
	return ctx;
}

const PLACEMENT = { fov: 40, position: [0, 2, 5] as const, target: [0, 0, 0] as const };
const LIMITS = { minDistance: 1, maxDistance: 10 };

class FakeOrbit implements ThreeOrbitControls {
	enabled = true;
	enablePan = false;
	enableZoom = false;
	enableRotate = false;
	enableDamping = false;
	target = new THREE.Vector3();
	listeners: Array<() => void> = [];
	update = vi.fn(() => false);
	dispose = vi.fn();
	addEventListener(_type: 'change', listener: () => void) {
		this.listeners.push(listener);
	}
	removeEventListener(_type: 'change', listener: () => void) {
		this.listeners = this.listeners.filter((l) => l !== listener);
	}
}

describe('hostedChart3DInteraction', () => {
	it('raises select/drag events only while interactive', () => {
		const ctx = fakeCtx(false);
		const interaction = hostedChart3DInteraction(ctx);
		const part = { role: 'dataPoint' as const, seriesIndex: 0, pointIndex: 1 };
		interaction.onSelect(part);
		interaction.onValueDragPreview(part, 3);
		expect(ctx.emit).not.toHaveBeenCalled();

		interaction.set(true);
		interaction.onSelect(part);
		interaction.onValueDragPreview(part, 3);
		interaction.onValueDragCommit(part, 4);
		expect(ctx.emit).toHaveBeenNthCalledWith(1, { type: 'select', part });
		expect(ctx.emit).toHaveBeenNthCalledWith(2, {
			type: 'drag',
			detail: { part, value: 3, phase: 'move' },
		});
		expect(ctx.emit).toHaveBeenNthCalledWith(3, {
			type: 'drag',
			detail: { part, value: 4, phase: 'commit' },
		});
	});
});

describe('createHostedChart3DStage / finishHostedChart3DScene', () => {
	it('works without the OrbitControls addon', () => {
		const ctx = fakeCtx(true);
		const stage = createHostedChart3DStage(ctx, PLACEMENT, LIMITS);
		expect(stage.orbit).toBeNull();
		expect(stage.controls.enabled).toBeFalsy();
		expect(stage.camera.aspect).toBe(2);
	});

	it('enables orbit only for an interactive view, and follows setInteractive', () => {
		const ctx = fakeCtx(false, FakeOrbit as unknown as ThreeViewContext['OrbitControls']);
		const stage = createHostedChart3DStage(ctx, PLACEMENT, LIMITS);
		const orbit = stage.orbit as unknown as FakeOrbit;
		expect(orbit.enabled).toBeFalsy();
		const interaction = hostedChart3DInteraction(ctx);
		const scene = finishHostedChart3DScene(ctx, stage, { dispose: vi.fn() }, interaction);
		scene.setInteractive?.(true);
		expect(orbit.enabled).toBeTruthy();
		interaction.onSelect(null);
		expect(ctx.emit).toHaveBeenCalledOnce();
	});

	it('asks for a frame on orbit changes and pointer input, and stops after dispose', () => {
		const ctx = fakeCtx(true, FakeOrbit as unknown as ThreeViewContext['OrbitControls']);
		const stage = createHostedChart3DStage(ctx, PLACEMENT, LIMITS);
		const orbit = stage.orbit as unknown as FakeOrbit;
		const dispose = vi.fn();
		const scene = finishHostedChart3DScene(ctx, stage, { dispose }, hostedChart3DInteraction(ctx));
		for (const listener of orbit.listeners) {
			listener();
		}
		ctx.eventTarget.dispatchEvent(new Event('pointermove'));
		expect(ctx.requestRender).toHaveBeenCalledTimes(2);

		scene.dispose();
		scene.dispose();
		expect(dispose).toHaveBeenCalledOnce();
		expect(orbit.dispose).toHaveBeenCalledOnce();
		expect(orbit.listeners).toHaveLength(0);
		ctx.eventTarget.dispatchEvent(new Event('pointermove'));
		expect(ctx.requestRender).toHaveBeenCalledTimes(2);
	});

	it('updates the camera aspect and calls the scene resize and afterRender hooks', () => {
		const ctx = fakeCtx(true);
		const stage = createHostedChart3DStage(ctx, PLACEMENT, LIMITS);
		const resize = vi.fn();
		const afterRender = vi.fn();
		const scene = finishHostedChart3DScene(
			ctx,
			stage,
			{ dispose: vi.fn(), resize, afterRender },
			hostedChart3DInteraction(ctx),
		);
		scene.resize({ width: 300, height: 100, pixelWidth: 300, pixelHeight: 100 });
		expect(stage.camera.aspect).toBe(3);
		expect(resize).toHaveBeenCalledWith(300, 100);
		scene.render({ render: vi.fn() } as unknown as THREE.WebGLRenderer);
		expect(afterRender).toHaveBeenCalledWith(stage.camera, 300, 100);
	});
});

describe('isChartInteractionArmed', () => {
	it('sees an armed chart root across a shadow boundary', () => {
		const root = document.createElement('div');
		const host = document.createElement('div');
		root.appendChild(host);
		const canvas = document.createElement('canvas');
		host.attachShadow({ mode: 'open' }).appendChild(canvas);
		expect(isChartInteractionArmed(canvas)).toBeFalsy();
		root.classList.add(CHART_INTERACTIVE_CLASS);
		expect(isChartInteractionArmed(canvas)).toBeTruthy();
	});

	it('is false for a missing node', () => {
		expect(isChartInteractionArmed(null)).toBeFalsy();
	});
});
