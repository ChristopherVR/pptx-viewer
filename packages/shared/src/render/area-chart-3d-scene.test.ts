import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AREA_CHART_THREE_UNAVAILABLE, mountAreaChart3D } from './area-chart-3d-scene';
import type { CartesianLine3DSceneOptions } from './cartesian-line-chart-3d-data';

// Mirrors line-chart-3d-scene.test.ts's fake-`three` harness, extended with a
// BufferGeometry/Float32BufferAttribute stand-in for the area-fill ribbon.

const h = vi.hoisted(() => {
	const fn = () => vi.fn();
	const calls = {
		rendererDispose: fn(),
		controlsDispose: fn(),
		markerGeometryDispose: fn(),
		tubeGeometryDispose: fn(),
		ribbonGeometryDispose: fn(),
		materialDispose: fn(),
		gridDispose: fn(),
		wallMatDispose: fn(),
	};
	const behaviour = {
		threeAvailable: true,
		orbitAvailable: true,
		raycastHits: [] as Array<{ object: { userData: unknown } }>,
	};
	const canvasListeners: Array<{
		type: string;
		cb: (e: { clientX: number; clientY: number }) => void;
	}> = [];
	return { calls, behaviour, canvasListeners };
});

function fakeElement(doc?: unknown) {
	const children: unknown[] = [];
	const el: Record<string, unknown> = {
		style: {} as Record<string, string>,
		children,
		ownerDocument: doc,
		appendChild(child: { parent?: unknown }) {
			child.parent = el;
			children.push(child);
		},
		removeChild(child: unknown) {
			const i = children.indexOf(child);
			if (i >= 0) {
				children.splice(i, 1);
			}
		},
		remove() {
			(el.parent as { removeChild?: (c: unknown) => void } | undefined)?.removeChild?.(el);
		},
	};
	return el;
}

function fakeDocument() {
	return { createElement: () => fakeElement() };
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
		copy() {
			return this;
		}
		project() {
			return this;
		}
	}
	class Object3DBase {
		position = { y: 0, set: () => {} };
		rotation = { set: () => {} };
		scale = { set: () => {} };
		aspect = 1;
		children: unknown[] = [];
		userData: unknown = {};
		target = new Vector3();
		add() {}
		clear() {}
		lookAt() {}
		updateProjectionMatrix() {}
	}
	class WebGLRenderer {
		domElement = {
			style: {} as Record<string, string>,
			parent: undefined as undefined | { removeChild: (c: unknown) => void },
			title: '',
			remove() {
				this.parent?.removeChild(this);
			},
			addEventListener(type: string, cb: (e: { clientX: number; clientY: number }) => void) {
				h.canvasListeners.push({ type, cb });
			},
			removeEventListener(type: string, cb: unknown) {
				const i = h.canvasListeners.findIndex((l) => l.type === type && l.cb === cb);
				if (i >= 0) {
					h.canvasListeners.splice(i, 1);
				}
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
		setFromCamera() {}
		intersectObjects() {
			return h.behaviour.raycastHits;
		}
	}
	class GridHelper {
		position = { y: 0 };
		dispose = h.calls.gridDispose;
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
		GridHelper,
		SphereGeometry: class {
			dispose = h.calls.markerGeometryDispose;
		},
		TubeGeometry: class {
			dispose = h.calls.tubeGeometryDispose;
		},
		CatmullRomCurve3: class {
			constructor(public points: unknown[]) {}
		},
		BufferGeometry: class {
			attributes: Record<string, unknown> = {};
			setAttribute(name: string, value: unknown) {
				this.attributes[name] = value;
				return this;
			}
			computeVertexNormals() {}
			dispose = h.calls.ribbonGeometryDispose;
		},
		Float32BufferAttribute: class {
			constructor(
				public array: number[],
				public itemSize: number,
			) {}
		},
		PlaneGeometry: class {
			dispose = vi.fn();
		},
		MeshPhongMaterial: class {
			dispose = h.calls.materialDispose;
		},
		MeshBasicMaterial: class {
			dispose = h.calls.wallMatDispose;
		},
		DoubleSide: 2,
		Vector3,
		Vector2,
		Raycaster,
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

function baseOptions(): CartesianLine3DSceneOptions {
	return {
		cols: 2,
		rows: 2,
		series: [
			{
				seriesIndex: 0,
				color: '#4472C4',
				depthZ: -0.25,
				baselineY: 0,
				vertices: [
					{ seriesIndex: 0, categoryIndex: 0, value: 10, position: [-0.25, 0.5, -0.25] },
					{ seriesIndex: 0, categoryIndex: 1, value: 20, position: [0.25, 1, -0.25] },
				],
			},
			{
				seriesIndex: 1,
				color: '#ED7D31',
				depthZ: 0.25,
				baselineY: 0,
				vertices: [
					{ seriesIndex: 1, categoryIndex: 0, value: 5, position: [-0.25, 0.25, 0.25] },
					{ seriesIndex: 1, categoryIndex: 1, value: 15, position: [0.25, 0.75, 0.25] },
				],
			},
		],
		categoryLabels: ['A', 'B'],
		seriesNames: ['S1', 'S2'],
		width: 200,
		height: 150,
	};
}

beforeEach(() => {
	vi.resetModules();
	h.behaviour.threeAvailable = true;
	h.behaviour.orbitAvailable = true;
	h.behaviour.raycastHits = [];
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

describe('mountAreaChart3D - dependencies missing', () => {
	it('returns the no-op sentinel when `three` cannot be imported', async () => {
		h.behaviour.threeAvailable = false;
		const container = fakeElement(fakeDocument());
		const handle = await mountAreaChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle).toBe(AREA_CHART_THREE_UNAVAILABLE);
		expect(handle.ok).toBeFalsy();
		expect(container.children).toHaveLength(0);
	});
});

describe('mountAreaChart3D - mounted scene', () => {
	it('mounts a canvas + label overlay and builds a ribbon per series', async () => {
		const container = fakeElement(fakeDocument());
		const handle = await mountAreaChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle.ok).toBeTruthy();
		expect(container.children).toHaveLength(2);
	});

	it('dispose frees the ribbon, tube, and marker geometries for every series', async () => {
		const container = fakeElement(fakeDocument());
		const handle = await mountAreaChart3D(container as unknown as HTMLElement, baseOptions());

		handle.dispose();

		expect(h.calls.rendererDispose).toHaveBeenCalledOnce();
		expect(h.calls.markerGeometryDispose).toHaveBeenCalledOnce();
		expect(h.calls.tubeGeometryDispose).toHaveBeenCalledTimes(2);
		expect(h.calls.ribbonGeometryDispose).toHaveBeenCalledTimes(2);
		expect(() => handle.dispose()).not.toThrow();
	});

	it('skips the ribbon for a single-vertex series (no segment to fill)', async () => {
		const options = baseOptions();
		options.series[1].vertices = [options.series[1].vertices[0]];
		const handle = await mountAreaChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			options,
		);
		expect(handle.ok).toBeTruthy();
		handle.dispose();
		expect(h.calls.ribbonGeometryDispose).toHaveBeenCalledOnce();
	});
});

describe('mountAreaChart3D - raycast hover tooltip', () => {
	it('sets the raycast hit marker userData as the canvas title', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { seriesIndex: 0, categoryIndex: 0, value: 10 } } },
		];
		const container = fakeElement(fakeDocument());
		const handle = await mountAreaChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle.ok).toBeTruthy();

		const entry = h.canvasListeners.find((l) => l.type === 'pointermove');
		entry?.cb({ clientX: 100, clientY: 75 });

		const canvas = container.children[0] as { title: string };
		expect(canvas.title).toBe('S1, A: 10');
	});
});
