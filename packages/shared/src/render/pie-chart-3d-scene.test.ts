import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PieChart3DSceneOptions } from './pie-chart-3d-data';
import { mountPieChart3D, PIE_CHART_THREE_UNAVAILABLE } from './pie-chart-3d-scene';

// Mirrors bar-chart-3d-scene.test.ts's fake-`three` harness.

const h = vi.hoisted(() => {
	const fn = () => vi.fn();
	const calls = {
		rendererDispose: fn(),
		controlsDispose: fn(),
		wedgeGeometryDispose: fn(),
		materialDispose: fn(),
	};
	const behaviour = {
		threeAvailable: true,
		orbitAvailable: true,
		raycastHits: [] as Array<{ object: { userData: unknown; material: unknown } }>,
		/** The world point `Raycaster.ray.intersectPlane` resolves to, or `null` to simulate a parallel (missed) ray. */
		planeHit: null as { x: number; y: number; z: number } | null,
		/** Whether the canvas sits inside an armed (`pptx-chart-interactive`) chart root. */
		armed: true,
	};
	const canvasListeners: Array<{ type: string; cb: (e: Record<string, unknown>) => void }> = [];
	return { calls, behaviour, canvasListeners };
});

function fakeElement() {
	const children: unknown[] = [];
	const el: Record<string, unknown> = {
		style: {} as Record<string, string>,
		children,
		appendChild(child: unknown) {
			children.push(child);
		},
	};
	return el;
}

vi.mock(import('three'), () => {
	if (!h.behaviour.threeAvailable) {
		throw new Error('Cannot find module three');
	}
	class Vector3 {
		x = 0;
		y = 0;
		z = 0;
		constructor(x = 0, y = 0, z = 0) {
			this.x = x;
			this.y = y;
			this.z = z;
		}
		set() {
			return this;
		}
	}
	class Object3DBase {
		position = { set: () => {} };
		aspect = 1;
		userData: unknown = {};
		add() {}
		clear() {}
		lookAt() {}
		updateProjectionMatrix() {}
	}
	class WebGLRenderer {
		domElement = {
			style: {} as Record<string, string>,
			title: '',
			remove() {},
			addEventListener(type: string, cb: (e: Record<string, unknown>) => void) {
				h.canvasListeners.push({ type, cb });
			},
			removeEventListener(type: string, cb: unknown) {
				const i = h.canvasListeners.findIndex((l) => l.type === type && l.cb === cb);
				if (i >= 0) {
					h.canvasListeners.splice(i, 1);
				}
			},
			// The scene is mounted inside an ARMED (`pptx-chart-interactive`) chart
			// root, so mark presses are the scene's own (see `isChartInteractionArmed`).
			closest(selector: string) {
				return h.behaviour.armed && selector === '.pptx-chart-interactive' ? {} : null;
			},
			getBoundingClientRect() {
				return { left: 0, top: 0, width: 200, height: 150 };
			},
		};
		setPixelRatio() {}
		setSize() {}
		render() {}
		dispose = h.calls.rendererDispose;
	}
	class Vector2 {
		x = 0;
		y = 0;
	}
	class Raycaster {
		ray = {
			intersectPlane(_plane: unknown, target: { x: number; y: number; z: number }) {
				const hit = h.behaviour.planeHit;
				if (!hit) {
					return null;
				}
				target.x = hit.x;
				target.y = hit.y;
				target.z = hit.z;
				return target;
			},
		};
		setFromCamera() {}
		intersectObjects() {
			return h.behaviour.raycastHits;
		}
	}
	class Plane {
		constructor(
			public normal: unknown,
			public constant: number,
		) {}
	}
	class MeshImpl extends Object3DBase {
		constructor(
			public geometry: unknown,
			public material: unknown,
		) {
			super();
		}
	}
	return {
		WebGLRenderer,
		Scene: Object3DBase,
		PerspectiveCamera: Object3DBase,
		AmbientLight: Object3DBase,
		DirectionalLight: Object3DBase,
		Mesh: MeshImpl,
		CylinderGeometry: class {
			dispose = h.calls.wedgeGeometryDispose;
		},
		MeshPhongMaterial: class {
			dispose = h.calls.materialDispose;
			emissive = { set: vi.fn() };
			emissiveIntensity = 0;
		},
		Vector3,
		Vector2,
		Raycaster,
		Plane,
	};
});

vi.mock(import('three/examples/jsm/controls/OrbitControls.js'), () => {
	if (!h.behaviour.orbitAvailable) {
		throw new Error('addon missing');
	}
	class OrbitControls {
		enablePan = true;
		enableZoom = true;
		enableRotate = true;
		minDistance = 0;
		maxDistance = 0;
		maxPolarAngle = 0;
		target = { copy: () => {} };
		update() {}
		dispose = h.calls.controlsDispose;
	}
	return { OrbitControls };
});

function baseOptions(): PieChart3DSceneOptions {
	return {
		wedges: [
			{
				pointIndex: 0,
				value: 30,
				color: '#4472C4',
				startAngle: 0,
				thetaLength: 1.5,
				explodeOffset: [0, 0],
			},
			{
				pointIndex: 1,
				value: 70,
				color: '#ED7D31',
				startAngle: 1.5,
				thetaLength: 4.7,
				explodeOffset: [0, 0],
			},
		],
		outerRadius: 1,
		thickness: 0.3,
		categoryLabels: ['A', 'B'],
		seriesName: 'S1',
		width: 200,
		height: 150,
		values: [30, 70],
		explosions: [0, 0],
		firstSliceAngleDeg: undefined,
	};
}

beforeEach(() => {
	vi.resetModules();
	h.behaviour.threeAvailable = true;
	h.behaviour.orbitAvailable = true;
	h.behaviour.raycastHits = [];
	h.behaviour.planeHit = null;
	h.behaviour.armed = true;
	h.canvasListeners.length = 0;
	vi.stubGlobal(
		'requestAnimationFrame',
		vi.fn(() => 7),
	);
	vi.stubGlobal(
		'cancelAnimationFrame',
		vi.fn(() => undefined),
	);
});

afterEach(() => {
	for (const c of Object.values(h.calls)) {
		c.mockClear();
	}
	vi.unstubAllGlobals();
});

describe('mountPieChart3D - dependencies missing', () => {
	it('returns the no-op sentinel when `three` cannot be imported', async () => {
		h.behaviour.threeAvailable = false;
		const handle = await mountPieChart3D(fakeElement() as unknown as HTMLElement, baseOptions());
		expect(handle).toBe(PIE_CHART_THREE_UNAVAILABLE);
		expect(handle.ok).toBeFalsy();
	});
});

describe('mountPieChart3D - mounted scene', () => {
	it('mounts a canvas and disposes wedge geometries/materials for every wedge', async () => {
		const handle = await mountPieChart3D(fakeElement() as unknown as HTMLElement, baseOptions());
		expect(handle.ok).toBeTruthy();
		handle.dispose();
		expect(h.calls.wedgeGeometryDispose).toHaveBeenCalledTimes(2);
		expect(h.calls.materialDispose).toHaveBeenCalledTimes(2);
		expect(h.calls.rendererDispose).toHaveBeenCalledOnce();
	});
});

describe('mountPieChart3D - click-to-select', () => {
	function fireAll(type: string, e: Record<string, unknown>): void {
		for (const l of h.canvasListeners.filter((entry) => entry.type === type)) {
			l.cb({ stopPropagation() {}, preventDefault() {}, ...e });
		}
	}

	it('fires onSelect with the clicked wedge on a plain click', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { pointIndex: 1, value: 70 }, material: {} } },
		];
		const onSelect = vi.fn();
		const handle = await mountPieChart3D(fakeElement() as unknown as HTMLElement, baseOptions(), {
			onSelect,
		});
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointerup', { clientX: 50, clientY: 50, pointerId: 1 });

		expect(onSelect).toHaveBeenCalledExactlyOnceWith({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 1,
		});
	});

	it('fires onSelect(null) clicking empty space', async () => {
		h.behaviour.raycastHits = [];
		const onSelect = vi.fn();
		const handle = await mountPieChart3D(fakeElement() as unknown as HTMLElement, baseOptions(), {
			onSelect,
		});
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointerup', { clientX: 50, clientY: 50, pointerId: 1 });

		expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
	});

	it('setSelectedPart on the handle applies the highlight without a click', async () => {
		const handle = await mountPieChart3D(fakeElement() as unknown as HTMLElement, baseOptions());
		expect(() =>
			handle.setSelectedPart({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 }),
		).not.toThrow();
		expect(() => handle.setSelectedPart(null)).not.toThrow();
	});
});

describe('mountPieChart3D - drag-to-value', () => {
	function fireAll(type: string, e: Record<string, unknown>): void {
		for (const l of h.canvasListeners.filter((entry) => entry.type === type)) {
			l.cb({ stopPropagation() {}, preventDefault() {}, ...e });
		}
	}

	/** Point the plane-raycast at `angle` radians, in `pieChart3DPointerAngle`'s atan2(x, z) convention. */
	function setPlaneAngle(angle: number): void {
		h.behaviour.planeHit = { x: Math.sin(angle), y: 0, z: Math.cos(angle) };
	}

	it('previews a live value drag, rebuilding the pie wedge geometry', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { pointIndex: 1, value: 70 }, material: {} } },
		];
		// Wedge 1's own leading edge is 1.5 (see baseOptions); sweep it a further
		// PI radians (half the circle) so both wedges recompute non-trivially.
		setPlaneAngle(1.5 + Math.PI);
		const onValueDragPreview = vi.fn();
		const handle = await mountPieChart3D(fakeElement() as unknown as HTMLElement, baseOptions(), {
			onValueDragPreview,
		});
		expect(handle.ok).toBeTruthy();
		h.calls.wedgeGeometryDispose.mockClear();

		const preventDefault = vi.fn();
		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1, preventDefault });
		// A wedge press with drag geometry is cancelled (no compat mousedown).
		expect(preventDefault).toHaveBeenCalledOnce();
		// Beyond the drag threshold (3px).
		fireAll('pointermove', { clientX: 50, clientY: 60, pointerId: 1 });

		expect(onValueDragPreview).toHaveBeenCalledOnce();
		const [part, value] = onValueDragPreview.mock.calls[0] as [unknown, number];
		expect(part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 });
		expect(Number.isFinite(value)).toBeTruthy();
		expect(value).toBeGreaterThanOrEqual(0);
		// Both wedges' geometry got rebuilt from the recomputed angle set.
		expect(h.calls.wedgeGeometryDispose).toHaveBeenCalledTimes(2);

		fireAll('pointerup', { clientX: 50, clientY: 60, pointerId: 1 });
	});

	it('commits the dragged value once on release', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { pointIndex: 1, value: 70 }, material: {} } },
		];
		setPlaneAngle(1.5 + Math.PI);
		const onValueDragCommit = vi.fn();
		const handle = await mountPieChart3D(fakeElement() as unknown as HTMLElement, baseOptions(), {
			onValueDragCommit,
		});
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointermove', { clientX: 50, clientY: 60, pointerId: 1 });
		fireAll('pointerup', { clientX: 50, clientY: 60, pointerId: 1 });

		expect(onValueDragCommit).toHaveBeenCalledOnce();
		const [part, value] = onValueDragCommit.mock.calls[0] as [unknown, number];
		expect(part).toStrictEqual({ role: 'dataPoint', seriesIndex: 0, pointIndex: 1 });
		expect(Number.isFinite(value)).toBeTruthy();
	});

	it('an un-armed chart lets the wedge press bubble to the stage and never drags', async () => {
		// Not selected / not editable: the press must reach the stage (it is what
		// selects the chart element) and moving must not sweep a wedge.
		h.behaviour.armed = false;
		h.behaviour.raycastHits = [
			{ object: { userData: { pointIndex: 1, value: 70 }, material: {} } },
		];
		setPlaneAngle(1.5 + Math.PI);
		const onValueDragPreview = vi.fn();
		const handle = await mountPieChart3D(fakeElement() as unknown as HTMLElement, baseOptions(), {
			onValueDragPreview,
		});
		expect(handle.ok).toBeTruthy();

		const stopPropagation = vi.fn();
		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1, stopPropagation });
		fireAll('pointermove', { clientX: 50, clientY: 60, pointerId: 1 });

		expect(stopPropagation).not.toHaveBeenCalled();
		expect(onValueDragPreview).not.toHaveBeenCalled();
	});

	it('an armed wedge press stops propagating so the stage never moves the chart element', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { pointIndex: 1, value: 70 }, material: {} } },
		];
		const handle = await mountPieChart3D(
			fakeElement() as unknown as HTMLElement,
			baseOptions(),
			{},
		);
		expect(handle.ok).toBeTruthy();

		const stopPropagation = vi.fn();
		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1, stopPropagation });
		expect(stopPropagation).toHaveBeenCalledOnce();
	});

	it('a plain click (no travel past the threshold) never fires a drag callback', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { pointIndex: 1, value: 70 }, material: {} } },
		];
		setPlaneAngle(1.5 + Math.PI);
		const onValueDragPreview = vi.fn();
		const onValueDragCommit = vi.fn();
		const onSelect = vi.fn();
		const handle = await mountPieChart3D(fakeElement() as unknown as HTMLElement, baseOptions(), {
			onSelect,
			onValueDragPreview,
			onValueDragCommit,
		});
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointerup', { clientX: 50, clientY: 50, pointerId: 1 });

		expect(onValueDragPreview).not.toHaveBeenCalled();
		expect(onValueDragCommit).not.toHaveBeenCalled();
		expect(onSelect).toHaveBeenCalledExactlyOnceWith({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 1,
		});
	});
});
