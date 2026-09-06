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
		wallMatDispose: fn(),
		markerGeometryDispose: fn(),
		markerMatDispose: fn(),
	};
	const behaviour = {
		threeAvailable: true,
		orbitAvailable: true,
		/** `Raycaster.intersectObject` fixture for the hover-tooltip tests. */
		raycastHits: [] as Array<{ faceIndex: number }>,
	};
	/** Canvas `addEventListener` calls, so tests can invoke the pointer handlers directly. */
	const canvasListeners: Array<{
		type: string;
		cb: (e: { clientX: number; clientY: number }) => void;
	}> = [];
	/**
	 * Every `new three.Mesh(...)` instance, in creation order, so tests can grab
	 * the LAST one created (the selection highlight marker, always created right
	 * after the surface mesh - and after any wall meshes when authored colours
	 * are set) without threading a distinguishing constructor arg through.
	 */
	const meshes: Array<{ visible: boolean; position: { x: number; y: number; z: number } }> = [];
	return { calls, behaviour, canvasListeners, meshes };
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
		position = {
			x: 0,
			y: 0,
			z: 0,
			set(x = 0, y = 0, z = 0) {
				this.x = x;
				this.y = y;
				this.z = z;
			},
		};
		rotation = { set: () => {} };
		aspect = 1;
		visible = true;
		children: unknown[] = [];
		target = new Vector3();
		add() {}
		clear() {}
		lookAt() {}
		updateProjectionMatrix() {}
	}
	/** Tracks every instance so tests can inspect the selection highlight marker (see `h.meshes`'s doc comment). */
	class TrackedMesh extends Object3DBase {
		constructor() {
			super();
			h.meshes.push(this);
		}
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
			// The scene is mounted inside an ARMED (`pptx-chart-interactive`) chart
			// root, so mark presses are the scene's own (see `isChartInteractionArmed`).
			closest(selector: string) {
				return selector === '.pptx-chart-interactive' ? {} : null;
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
	class SphereGeometry {
		dispose = h.calls.markerGeometryDispose;
	}
	return {
		WebGLRenderer,
		Scene: Object3DBase,
		PerspectiveCamera: Object3DBase,
		AmbientLight: Object3DBase,
		DirectionalLight: Object3DBase,
		Mesh: TrackedMesh,
		LineSegments: Object3DBase,
		GridHelper,
		PlaneGeometry: BufferGeometry,
		SphereGeometry,
		WireframeGeometry,
		BufferAttribute: class {},
		// Shared by the surface mesh's own material (`vertexColors: true`) and
		// the selection highlight marker's material (no `vertexColors`), so
		// dispose is routed to the matching call record by that option.
		MeshPhongMaterial: class {
			emissive = { set: () => {} };
			emissiveIntensity = 0;
			dispose: () => void;
			constructor(opts: { vertexColors?: boolean } = {}) {
				this.dispose = opts.vertexColors ? h.calls.surfaceMatDispose : h.calls.markerMatDispose;
			}
		},
		LineBasicMaterial: class {
			dispose = h.calls.wireMatDispose;
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
	h.behaviour.raycastHits = [];
	h.canvasListeners.length = 0;
	h.meshes.length = 0;
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
		expect(h.calls.markerGeometryDispose).toHaveBeenCalledOnce();
		expect(h.calls.markerMatDispose).toHaveBeenCalledOnce();
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

	it('does not build wall/floor material when no surfaceColors are authored', async () => {
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		handle.dispose();
		expect(h.calls.wallMatDispose).not.toHaveBeenCalled();
	});

	it('mounts and disposes floor/wall panels when surfaceColors are authored', async () => {
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			{
				...baseOptions(),
				surfaceColors: { floor: '#111111', backWall: '#222222', sideWall: '#333333' },
			},
		);
		expect(handle.ok).toBeTruthy();
		handle.dispose();
		expect(h.calls.wallMatDispose).toHaveBeenCalledTimes(3);
	});
});

describe('mountSurfaceChart3D - raycast hover tooltip', () => {
	function moveHandler(): (e: { clientX: number; clientY: number }) => void {
		const entry = h.canvasListeners.find((l) => l.type === 'pointermove');
		if (!entry) {
			throw new Error('pointermove listener was not registered');
		}
		return entry.cb;
	}

	it('registers the hover-tooltip AND click pointer listeners on the canvas', async () => {
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		expect(handle.ok).toBeTruthy();
		expect(h.canvasListeners.map((l) => l.type)).toStrictEqual([
			'pointermove',
			'pointerleave',
			'pointerdown',
			'pointermove',
			'pointerup',
			'pointercancel',
		]);
	});

	it('sets the raycast hit cell as the canvas title, matching buildMarkTooltip text', async () => {
		h.behaviour.raycastHits = [{ faceIndex: 0 }];
		const container = fakeElement(fakeDocument());
		const handle = await mountSurfaceChart3D(container as unknown as HTMLElement, {
			...baseOptions(),
			// row-major rows*cols=4: row0=[10,20] (S1), row1=[30,40] (S2).
			values: new Float32Array([10, 20, 30, 40]),
		});
		expect(handle.ok).toBeTruthy();

		moveHandler()({ clientX: 100, clientY: 75 });

		const canvas = container.children[0] as { title: string };
		// faceIndex 0 -> quad 0 -> the (row 0, col 0) facet -> S1/A/10.
		expect(canvas.title).toBe('S1, A: 10');
	});

	it('clears the title when the ray misses the mesh', async () => {
		h.behaviour.raycastHits = [];
		const container = fakeElement(fakeDocument());
		const handle = await mountSurfaceChart3D(container as unknown as HTMLElement, {
			...baseOptions(),
			values: new Float32Array([10, 20, 30, 40]),
		});
		expect(handle.ok).toBeTruthy();
		const canvas = container.children[0] as { title: string };

		moveHandler()({ clientX: 100, clientY: 75 });
		expect(canvas.title).toBe('');
	});

	it('never sets a title when the scene has no raw values (older callers)', async () => {
		h.behaviour.raycastHits = [{ faceIndex: 0 }];
		const container = fakeElement(fakeDocument());
		const handle = await mountSurfaceChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle.ok).toBeTruthy();
		const canvas = container.children[0] as { title: string };

		moveHandler()({ clientX: 100, clientY: 75 });
		expect(canvas.title).toBe('');
	});

	it('dispose removes the pointer listeners', async () => {
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		handle.dispose();
		expect(h.canvasListeners).toHaveLength(0);
	});
});

describe('mountSurfaceChart3D - click-to-select / drag-to-value', () => {
	function fireAll(type: string, e: Record<string, unknown>): void {
		for (const l of h.canvasListeners.filter((entry) => entry.type === type)) {
			l.cb({ stopPropagation() {}, preventDefault() {}, ...e } as never);
		}
	}

	it('fires onSelect with the clicked facet (row, col) on a plain click', async () => {
		h.behaviour.raycastHits = [{ faceIndex: 0 }];
		const onSelect = vi.fn();
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
			{ onSelect },
		);
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointerup', { clientX: 50, clientY: 50, pointerId: 1 });

		// faceIndex 0 -> quad 0 -> the (row 0, col 0) facet.
		expect(onSelect).toHaveBeenCalledExactlyOnceWith({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 0,
		});
	});

	it('fires onSelect(null) clicking empty space', async () => {
		h.behaviour.raycastHits = [];
		const onSelect = vi.fn();
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
			{ onSelect },
		);
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointerup', { clientX: 50, clientY: 50, pointerId: 1 });

		expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
	});

	it('drags a vertex past the threshold: preview then commit fire, onSelect does not', async () => {
		h.behaviour.raycastHits = [{ faceIndex: 0 }];
		const onSelect = vi.fn();
		const onValueDragPreview = vi.fn();
		const onValueDragCommit = vi.fn();
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			{ ...baseOptions(), values: new Float32Array([10, 20, 30, 40]) },
			{ onSelect, onValueDragPreview, onValueDragCommit },
		);
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointermove', { clientX: 50, clientY: 20, pointerId: 1 });
		expect(onValueDragPreview).toHaveBeenCalledWith(
			{ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 },
			expect.any(Number),
		);
		fireAll('pointerup', { clientX: 50, clientY: 20, pointerId: 1 });

		expect(onValueDragCommit).toHaveBeenCalledOnce();
		expect(onSelect).not.toHaveBeenCalled();
	});

	it('does not calibrate a drag when every cell shares the same value (no vertical axis)', async () => {
		h.behaviour.raycastHits = [{ faceIndex: 0 }];
		const onValueDragPreview = vi.fn();
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			{ ...baseOptions(), values: new Float32Array([5, 5, 5, 5]) },
			{ onValueDragPreview },
		);
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointermove', { clientX: 50, clientY: 20, pointerId: 1 });

		expect(onValueDragPreview).not.toHaveBeenCalled();
	});

	it('setSelectedPart shows the highlight marker at the selected vertex, and hides it again for null', async () => {
		const handle = await mountSurfaceChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		// The marker mesh is the LAST `Mesh` created (right after the surface
		// mesh); baseOptions() has no wall colours, so it's index 1 of 2.
		const marker = h.meshes.at(-1)!;
		expect(marker.visible).toBeFalsy();

		handle.setSelectedPart({ role: 'dataPoint', seriesIndex: 1, pointIndex: 0 });
		expect(marker.visible).toBeTruthy();
		// (row 1, col 0) of a 2x2 grid: x at the left edge, z at the far edge.
		expect(marker.position.x).toBeCloseTo(-0.25);
		expect(marker.position.z).toBeCloseTo(0.25);

		handle.setSelectedPart(null);
		expect(marker.visible).toBeFalsy();
	});
});
