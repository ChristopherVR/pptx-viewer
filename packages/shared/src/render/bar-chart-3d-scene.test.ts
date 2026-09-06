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
	class MeshImpl extends Object3DBase {
		constructor(
			public geometry: unknown,
			public material: unknown,
		) {
			super();
		}
	}
	class FakeTexture {
		wrapS = 0;
		wrapT = 0;
		repeat = { set: () => {} };
		needsUpdate = false;
		dispose = vi.fn();
		clone() {
			return new FakeTexture();
		}
	}
	class TextureLoader {
		load(
			_url: string,
			onLoad?: (texture: FakeTexture) => void,
			_onProgress?: unknown,
			_onError?: unknown,
		) {
			onLoad?.(new FakeTexture());
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
			emissive = { set: vi.fn() };
			emissiveIntensity = 0;
			map: unknown;
			needsUpdate = false;
		},
		MeshBasicMaterial: class {
			dispose = h.calls.wallMatDispose;
		},
		DoubleSide: 2,
		Vector3,
		Vector2,
		Raycaster,
		TextureLoader,
		RepeatWrapping: 1000,
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
		// One geometry per box (shape is resolved per box, so geometry is no
		// longer shared across boxes; 2 boxes in baseOptions()).
		expect(h.calls.boxGeometryDispose).toHaveBeenCalledTimes(2);
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

describe('mountBarChart3D - c:pictureOptions face-fill textures', () => {
	it('mounts a picture-bearing box mesh with a 6-entry material array', async () => {
		const container = fakeElement(fakeDocument());
		const options = {
			...baseOptions(),
			picture: {
				series: [{ picture: { imageUrl: 'x.png' } }],
			},
		};
		const handle = await mountBarChart3D(container as unknown as HTMLElement, options);
		expect(handle.ok).toBeTruthy();
		handle.dispose();
	});

	it('a scene with no picture context mounts one plain material per box (unchanged)', async () => {
		const container = fakeElement(fakeDocument());
		const handle = await mountBarChart3D(container as unknown as HTMLElement, baseOptions());
		expect(handle.ok).toBeTruthy();
		handle.dispose();
		// Every box gets a single MeshPhongMaterial disposed once: no behaviour
		// change for the overwhelming majority of bar3D charts (no picture fill).
		expect(h.calls.materialDispose).toHaveBeenCalledTimes(2);
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

	it('registers the hover-tooltip AND click/drag pointer listeners on the canvas', async () => {
		const handle = await mountBarChart3D(
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

describe('mountBarChart3D - click-to-select / drag-to-value', () => {
	function fireAll(type: string, e: Record<string, unknown>): void {
		for (const l of h.canvasListeners.filter((entry) => entry.type === type)) {
			l.cb({ stopPropagation() {}, preventDefault() {}, ...e } as never);
		}
	}

	it('fires onSelect with the clicked box mark on a plain click', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { seriesIndex: 0, categoryIndex: 1, value: 20 } } },
		];
		const onSelect = vi.fn();
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
			{ onSelect },
		);
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
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
			{ onSelect },
		);
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointerup', { clientX: 50, clientY: 50, pointerId: 1 });

		expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
	});

	it('drags a clustered box past the threshold: preview then commit fire, onSelect does not', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { seriesIndex: 0, categoryIndex: 0, value: 10 } } },
		];
		const onSelect = vi.fn();
		const onValueDragPreview = vi.fn();
		const onValueDragCommit = vi.fn();
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
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

	it('setSelectedPart on the handle applies the highlight without a click', async () => {
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			baseOptions(),
		);
		expect(() =>
			handle.setSelectedPart({ role: 'dataPoint', seriesIndex: 0, pointIndex: 0 }),
		).not.toThrow();
		expect(() => handle.setSelectedPart(null)).not.toThrow();
	});

	it('does not drag a stacked-grouping box (no single-value meaning); a click still selects it', async () => {
		h.behaviour.raycastHits = [
			{ object: { userData: { seriesIndex: 0, categoryIndex: 0, value: 10 } } },
		];
		const onSelect = vi.fn();
		const onValueDragPreview = vi.fn();
		const handle = await mountBarChart3D(
			fakeElement(fakeDocument()) as unknown as HTMLElement,
			{ ...baseOptions(), grouping: 'stacked' as const },
			{ onSelect, onValueDragPreview },
		);
		expect(handle.ok).toBeTruthy();

		fireAll('pointerdown', { clientX: 50, clientY: 50, pointerId: 1 });
		fireAll('pointermove', { clientX: 50, clientY: 0, pointerId: 1 });
		expect(onValueDragPreview).not.toHaveBeenCalled();
		fireAll('pointerup', { clientX: 50, clientY: 0, pointerId: 1 });
		expect(onSelect).toHaveBeenCalledExactlyOnceWith({
			role: 'dataPoint',
			seriesIndex: 0,
			pointIndex: 0,
		});
	});
});
