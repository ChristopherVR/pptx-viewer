import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountSurfaceChart3D, SURFACE_THREE_UNAVAILABLE } from './surface-chart-3d-scene';

// Shared tests run in the default node environment, so the controller is
// exercised against hand-rolled DOM stand-ins plus a faked `three` module that
// implements only the surface this controller touches. The fakes are created
// ONCE in `vi.hoisted` (vitest caches mock factory results) and their call
// records are cleared between tests; `behaviour` toggles select the missing-
// dependency paths without re-mocking.

const h = vi.hoisted(() => {
	const fn = () => vi.fn();
	const calls = {
		rendererDispose: fn(),
		controlsDispose: fn(),
		geometryDispose: fn(),
		wireGeometryDispose: fn(),
		surfaceMatDispose: fn(),
		wireMatDispose: fn(),
		gridDispose: fn(),
	};
	const behaviour = { threeAvailable: true, orbitAvailable: true };
	return { calls, behaviour };
});

/** Minimal DOM element stand-in tracking appended/removed children. */
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

/** A document stand-in whose createElement returns label/overlay fakes. */
function fakeDocument() {
	return {
		createElement: () => fakeElement(),
	};
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
		aspect = 1;
		children: unknown[] = [];
		target = new Vector3();
		add() {}
		clear() {}
		lookAt() {}
		updateProjectionMatrix() {}
	}
	class BufferGeometry {
		attributes = {
			position: {
				count: 4,
				setY: () => {},
				needsUpdate: false,
			},
		};
		rotateX() {}
		setAttribute() {}
		computeVertexNormals() {}
		dispose = h.calls.geometryDispose;
	}
	class WireframeGeometry {
		dispose = h.calls.wireGeometryDispose;
	}
	class WebGLRenderer {
		domElement = {
			style: {} as Record<string, string>,
			parent: undefined as undefined | { removeChild: (c: unknown) => void },
			remove() {
				this.parent?.removeChild(this);
			},
		};
		setPixelRatio() {}
		setSize() {}
		render() {}
		dispose = h.calls.rendererDispose;
	}
	class GridHelper {
		position = { y: 0 };
		dispose = h.calls.gridDispose;
	}
	return {
		WebGLRenderer,
		Scene: Object3DBase,
		PerspectiveCamera: Object3DBase,
		AmbientLight: Object3DBase,
		DirectionalLight: Object3DBase,
		Mesh: Object3DBase,
		LineSegments: Object3DBase,
		GridHelper,
		PlaneGeometry: BufferGeometry,
		WireframeGeometry,
		BufferAttribute: class {},
		MeshPhongMaterial: class {
			dispose = h.calls.surfaceMatDispose;
		},
		LineBasicMaterial: class {
			dispose = h.calls.wireMatDispose;
		},
		DoubleSide: 2,
		Vector3,
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

function baseOptions() {
	return {
		cols: 2,
		rows: 2,
		heightMap: new Float32Array([0, 0.5, 1, 0.25]),
		colorMap: new Float32Array(2 * 2 * 3).fill(0.5),
		wireframe: true,
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

describe('mountSurfaceChart3D - dependencies missing', () => {
	it('returns the no-op sentinel when `three` cannot be imported', async () => {
		h.behaviour.threeAvailable = false;
		const container = fakeElement(fakeDocument());
		const handle = await mountSurfaceChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle).toBe(SURFACE_THREE_UNAVAILABLE);
		expect(handle.ok).toBeFalsy();
		expect(container.children).toHaveLength(0);
		expect(() => {
			handle.resize(10, 10);
			handle.dispose();
		}).not.toThrow();
	});

	it('returns the sentinel when the OrbitControls addon is missing', async () => {
		h.behaviour.orbitAvailable = false;
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		expect(handle.ok).toBeFalsy();
	});
});

describe('mountSurfaceChart3D - mounted scene', () => {
	it('mounts a canvas + label overlay and starts a render loop', async () => {
		const container = fakeElement(fakeDocument());
		const handle = await mountSurfaceChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle.ok).toBeTruthy();
		// canvas + overlay layer.
		expect(container.children).toHaveLength(2);
		const raf = globalThis.requestAnimationFrame as unknown as ReturnType<typeof vi.fn>;
		expect(raf.mock.calls.length).toBeGreaterThan(0);
	});

	it('dispose stops the loop, removes nodes, and frees GPU resources', async () => {
		const container = fakeElement(fakeDocument());
		const handle = await mountSurfaceChart3D(container as unknown as HTMLElement, baseOptions());

		handle.dispose();

		expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(7);
		expect(container.children).toHaveLength(0);
		expect(h.calls.rendererDispose).toHaveBeenCalledOnce();
		expect(h.calls.controlsDispose).toHaveBeenCalledOnce();
		expect(h.calls.geometryDispose).toHaveBeenCalledOnce();
		expect(h.calls.wireGeometryDispose).toHaveBeenCalledOnce();
		expect(h.calls.surfaceMatDispose).toHaveBeenCalledOnce();
		expect(h.calls.wireMatDispose).toHaveBeenCalledOnce();
		expect(h.calls.gridDispose).toHaveBeenCalledOnce();
		// Second dispose is a guarded no-op.
		expect(() => handle.dispose()).not.toThrow();
		expect(h.calls.rendererDispose).toHaveBeenCalledOnce();
	});

	it('does not build wireframe material when wireframe is off', async () => {
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			{ ...baseOptions(), wireframe: false },
		);
		handle.dispose();
		expect(h.calls.wireMatDispose).not.toHaveBeenCalled();
		// The wireframe geometry is still built (and disposed) regardless.
		expect(h.calls.wireGeometryDispose).toHaveBeenCalledOnce();
	});

	it('resize does not throw on a live handle', async () => {
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		expect(() => handle.resize(400, 300)).not.toThrow();
		handle.dispose();
	});
});
