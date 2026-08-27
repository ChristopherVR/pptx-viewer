import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BarChart3DBox } from './bar-chart-3d-data';
import { BAR_CHART_THREE_UNAVAILABLE, mountBarChart3D } from './bar-chart-3d-scene';

// Mirrors surface-chart-3d-scene.test.ts's fake-`three` harness, extended
// with a BoxGeometry/Mesh stand-in that records per-mesh userData so the
// raycast-hover tests can assert the (series, category) reported for a hit.

const h = vi.hoisted(() => {
	const fn = () => vi.fn();
	const calls = {
		rendererDispose: fn(),
		controlsDispose: fn(),
		boxGeometryDispose: fn(),
		materialDispose: fn(),
		gridDispose: fn(),
		wallGeoDispose: fn(),
		wallMatDispose: fn(),
	};
	const behaviour = {
		threeAvailable: true,
		orbitAvailable: true,
		/** `Raycaster.intersectObjects` fixture for the hover-tooltip tests. */
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
	class BoxGeometry {
		dispose = h.calls.boxGeometryDispose;
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
		BoxGeometry,
		PlaneGeometry: class {
			dispose = h.calls.wallGeoDispose;
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

function makeBoxes(): BarChart3DBox[] {
	return [
		{
			seriesIndex: 0,
			categoryIndex: 0,
			value: 10,
			color: '#4472C4',
			center: [0, 0.5, 0],
			size: [0.4, 1, 0.4],
		},
		{
			seriesIndex: 0,
			categoryIndex: 1,
			value: 20,
			color: '#4472C4',
			center: [0.5, 1, 0],
			size: [0.4, 2, 0.4],
		},
	];
}

function baseOptions() {
	return {
		cols: 2,
		rows: 1,
		boxes: makeBoxes(),
		categoryLabels: ['A', 'B'],
		seriesNames: ['S1'],
		grouping: 'clustered' as const,
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

describe('mountBarChart3D - dependencies missing', () => {
	it('returns the no-op sentinel when `three` cannot be imported', async () => {
		h.behaviour.threeAvailable = false;
		const container = fakeElement(fakeDocument());
		const handle = await mountBarChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle).toBe(BAR_CHART_THREE_UNAVAILABLE);
		expect(handle.ok).toBeFalsy();
		expect(container.children).toHaveLength(0);
		expect(() => {
			handle.resize(10, 10);
			handle.dispose();
		}).not.toThrow();
	});

	it('returns the sentinel when the OrbitControls addon is missing', async () => {
		h.behaviour.orbitAvailable = false;
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		expect(handle.ok).toBeFalsy();
	});
});

describe('mountBarChart3D - mounted scene', () => {
	it('mounts a canvas + label overlay and starts a render loop', async () => {
		const container = fakeElement(fakeDocument());
		const handle = await mountBarChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle.ok).toBeTruthy();
		expect(container.children).toHaveLength(2);
		const raf = globalThis.requestAnimationFrame as unknown as ReturnType<typeof vi.fn>;
		expect(raf.mock.calls.length).toBeGreaterThan(0);
	});

	it('dispose stops the loop, removes nodes, and frees GPU resources for every box', async () => {
		const container = fakeElement(fakeDocument());
		const handle = await mountBarChart3D(container as unknown as HTMLElement, baseOptions());

		handle.dispose();

		expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(7);
		expect(container.children).toHaveLength(0);
		expect(h.calls.rendererDispose).toHaveBeenCalledOnce();
		expect(h.calls.controlsDispose).toHaveBeenCalledOnce();
		// One shared box geometry, disposed once.
		expect(h.calls.boxGeometryDispose).toHaveBeenCalledOnce();
		// One material per box (2 boxes in baseOptions()).
		expect(h.calls.materialDispose).toHaveBeenCalledTimes(2);
		expect(h.calls.gridDispose).toHaveBeenCalledOnce();
		expect(() => handle.dispose()).not.toThrow();
		expect(h.calls.rendererDispose).toHaveBeenCalledOnce();
	});

	it('resize does not throw on a live handle', async () => {
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		expect(() => handle.resize(400, 300)).not.toThrow();
		handle.dispose();
	});

	it('does not build wall/floor panels when no wallColors are authored', async () => {
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		handle.dispose();
		expect(h.calls.wallMatDispose).not.toHaveBeenCalled();
	});

	it('mounts and disposes floor/wall panels when wallColors are authored', async () => {
		const handle = await mountBarChart3D(fakeElement(fakeDocument()) as unknown as HTMLElement, {
			...baseOptions(),
			wallColors: { floor: '#111111', backWall: '#222222', sideWall: '#333333' },
		});
		expect(handle.ok).toBeTruthy();
		handle.dispose();
		expect(h.calls.wallMatDispose).toHaveBeenCalledTimes(3);
	});
});

describe('mountBarChart3D - raycast hover tooltip', () => {
	function moveHandler(): (e: { clientX: number; clientY: number }) => void {
		const entry = h.canvasListeners.find((l) => l.type === 'pointermove');
		if (!entry) {
			throw new Error('pointermove listener was not registered');
		}
		return entry.cb;
	}

	it('registers pointermove/pointerleave listeners on the canvas', async () => {
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		expect(handle.ok).toBeTruthy();
		expect(h.canvasListeners.map((l) => l.type)).toStrictEqual(['pointermove', 'pointerleave']);
	});

	it('sets the raycast hit box userData as the canvas title, matching buildMarkTooltip text', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { seriesIndex: 0, categoryIndex: 1, value: 20 } } },
		];
		const container = fakeElement(fakeDocument());
		const handle = await mountBarChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle.ok).toBeTruthy();

		moveHandler()({ clientX: 100, clientY: 75 });

		const canvas = container.children[0] as { title: string };
		expect(canvas.title).toBe('S1, B: 20');
	});

	it('clears the title when the ray misses every box', async () => {
		h.behaviour.raycastHits = [];
		const container = fakeElement(fakeDocument());
		const handle = await mountBarChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle.ok).toBeTruthy();
		const canvas = container.children[0] as { title: string };

		moveHandler()({ clientX: 100, clientY: 75 });
		expect(canvas.title).toBe('');
	});

	it('dispose removes the pointer listeners', async () => {
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		handle.dispose();
		expect(h.canvasListeners).toHaveLength(0);
	});
});
