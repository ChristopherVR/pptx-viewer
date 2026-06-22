import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountModel3D, THREE_UNAVAILABLE } from './model3d-scene';

// Shared tests run in the default node environment (no DOM globals), so the
// controller is exercised against hand-rolled element/canvas stand-ins that
// expose only the surface it touches (appendChild/remove/style/children).
//
// `three` and its addons are dynamically imported; vitest caches a mock module
// factory's result, so the fakes are created ONCE in `vi.hoisted` and their
// call records are cleared between tests rather than rebuilt. `behaviour`
// toggles let individual tests opt into the "missing dependency" / "load error"
// paths without re-mocking.

const h = vi.hoisted(() => {
	const fn = () => vi.fn();

	const rendererDispose = fn();
	const controlsDispose = fn();
	const geometryDispose = fn();
	const materialDispose = fn();

	const behaviour = {
		threeAvailable: true,
		gltfLoaderAvailable: true,
		loadSucceeds: true,
	};

	const calls = {
		rendererDispose,
		controlsDispose,
		geometryDispose,
		materialDispose,
	};

	return { behaviour, calls };
});

/** A minimal DOM-element stand-in tracking appended/removed children. */
function fakeElement() {
	const children: unknown[] = [];
	const el = {
		style: {} as Record<string, string>,
		children,
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
		set() {
			return this;
		}
		multiplyScalar() {
			return this;
		}
		sub() {
			return this;
		}
	}
	class Box3 {
		setFromObject() {
			return this;
		}
		getSize(v: Vector3) {
			v.x = 2;
			v.y = 1;
			v.z = 1;
			return v;
		}
		getCenter(v: Vector3) {
			return v;
		}
	}
	class Object3DBase {
		position = new Vector3();
		scale = { setScalar: () => {}, x: 1 };
		aspect = 1;
		children: Object3DBase[] = [];
		add() {}
		clear() {}
		lookAt() {}
		updateProjectionMatrix() {}
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
	return {
		WebGLRenderer,
		Scene: Object3DBase,
		PerspectiveCamera: Object3DBase,
		AmbientLight: Object3DBase,
		DirectionalLight: Object3DBase,
		Color: class {},
		Box3,
		Vector3,
	};
});

vi.mock(import('three/examples/jsm/loaders/GLTFLoader.js'), () => {
	if (!h.behaviour.gltfLoaderAvailable) {
		throw new Error('addon missing');
	}
	class GLTFLoader {
		load(
			_url: string,
			onLoad: (g: unknown) => void,
			_onProgress: undefined,
			onError: (e: Error) => void,
		) {
			if (!h.behaviour.loadSucceeds) {
				onError(new Error('bad glb'));
				return;
			}
			onLoad({
				scene: {
					scale: { setScalar: () => {}, x: 1 },
					position: { sub: () => {} },
					traverse(cb: (o: unknown) => void) {
						cb(this);
						cb({
							geometry: { dispose: h.calls.geometryDispose },
							material: { dispose: h.calls.materialDispose },
						});
					},
				},
			});
		}
	}
	return { GLTFLoader };
});

vi.mock(import('three/examples/jsm/controls/OrbitControls.js'), () => {
	class OrbitControls {
		enablePan = true;
		enableZoom = true;
		enableRotate = true;
		minDistance = 0;
		maxDistance = 0;
		update() {}
		dispose = h.calls.controlsDispose;
	}
	return { OrbitControls };
});

beforeEach(() => {
	// Re-run the (cached) mock factories on the next dynamic import so each test
	// can choose the available/unavailable path via the `behaviour` flags.
	vi.resetModules();
	h.behaviour.threeAvailable = true;
	h.behaviour.gltfLoaderAvailable = true;
	h.behaviour.loadSucceeds = true;
	// node has no RAF; provide deterministic stubs each test.
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
	h.calls.rendererDispose.mockClear();
	h.calls.controlsDispose.mockClear();
	h.calls.geometryDispose.mockClear();
	h.calls.materialDispose.mockClear();
	vi.unstubAllGlobals();
});

describe('mountModel3D - three unavailable', () => {
	it('returns the no-op sentinel when `three` cannot be imported', async () => {
		h.behaviour.threeAvailable = false;
		const container = fakeElement();
		const handle = await mountModel3D(container as unknown as HTMLElement, 'blob:model', {
			width: 100,
			height: 80,
		});
		expect(handle).toBe(THREE_UNAVAILABLE);
		expect(handle.ok).toBeFalsy();
		expect(container.children).toHaveLength(0);
		expect(() => {
			handle.resize(10, 10);
			handle.setInteractive(true);
			handle.dispose();
		}).not.toThrow();
	});

	it('returns the sentinel when the GLTFLoader addon is missing', async () => {
		h.behaviour.gltfLoaderAvailable = false;
		const handle = await mountModel3D(fakeElement() as unknown as HTMLElement, 'blob:model', {
			width: 64,
			height: 64,
		});
		expect(handle.ok).toBeFalsy();
	});
});

describe('mountModel3D - mounted scene', () => {
	it('mounts a canvas, returns an ok handle, and starts a render loop', async () => {
		const container = fakeElement();
		const handle = await mountModel3D(container as unknown as HTMLElement, 'blob:model', {
			width: 120,
			height: 90,
			background: '#101010',
		});
		expect(handle.ok).toBeTruthy();
		expect(container.children).toHaveLength(1);
		const raf = globalThis.requestAnimationFrame as unknown as ReturnType<typeof vi.fn>;
		expect(raf.mock.calls.length).toBeGreaterThan(0);
	});

	it('dispose stops the loop, removes the canvas, and frees GPU resources', async () => {
		const container = fakeElement();
		const handle = await mountModel3D(container as unknown as HTMLElement, 'blob:model', {
			width: 100,
			height: 100,
		});

		handle.dispose();

		expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(7);
		expect(container.children).toHaveLength(0);
		expect(h.calls.rendererDispose).toHaveBeenCalledOnce();
		expect(h.calls.controlsDispose).toHaveBeenCalledOnce();
		expect(h.calls.geometryDispose).toHaveBeenCalledOnce();
		expect(h.calls.materialDispose).toHaveBeenCalledOnce();
		// Second dispose is a guarded no-op.
		expect(() => handle.dispose()).not.toThrow();
		expect(h.calls.rendererDispose).toHaveBeenCalledOnce();
	});

	it('returns the sentinel and cleans up when the model fails to load', async () => {
		h.behaviour.loadSucceeds = false;
		const container = fakeElement();
		const handle = await mountModel3D(container as unknown as HTMLElement, 'blob:model', {
			width: 50,
			height: 50,
		});
		expect(handle.ok).toBeFalsy();
		expect(container.children).toHaveLength(0);
		expect(h.calls.rendererDispose).toHaveBeenCalledOnce();
	});

	it('setInteractive(false) disposes existing controls', async () => {
		const handle = await mountModel3D(fakeElement() as unknown as HTMLElement, 'blob:model', {
			width: 80,
			height: 80,
			interactive: true,
		});
		handle.setInteractive(false);
		expect(h.calls.controlsDispose).toHaveBeenCalledOnce();
	});
});
