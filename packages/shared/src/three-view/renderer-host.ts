/**
 * One shared WebGL context for every `<pptx-three-view>` on the page.
 *
 * Browsers cap live WebGL contexts at roughly 16 per page and silently kill
 * the oldest when a new one is created. Before this host, every 3D chart and
 * SmartArt graphic (on the slide AND in each thumbnail) created its own
 * `WebGLRenderer`, so a deck with more than a handful of them rendered a
 * blank main slide: its context was the one the thumbnails had evicted.
 *
 * Here a single offscreen `WebGLRenderer` draws each dirty view into the top
 * left of its own drawing buffer, and the pixels are copied straight onto
 * the view's own 2D `<canvas>` in the same task (so no
 * `preserveDrawingBuffer` is needed). Views render on demand only: a scene
 * asks for a frame when something changed, and only scenes that report
 * `isAnimating()` keep getting frames. A 2D canvas is also something every
 * export path (html2canvas, `toDataURL`) can read, which a WebGL canvas
 * without `preserveDrawingBuffer` is not.
 *
 * @module three-view/renderer-host
 */
import type * as THREE from 'three';

import type { ThreeModule } from './types';

/** Largest backing-store edge a single view is drawn at, in device pixels. */
export const MAX_VIEW_PIXELS = 4096;

/** A view the host draws: its target canvas, its size, and how to draw it. */
export interface HostedView {
	/** The 2D canvas the view's pixels are copied onto. */
	readonly canvas: HTMLCanvasElement;
	/** Current backing size in device pixels. */
	pixelSize: () => { width: number; height: number };
	/** Whether the view is currently worth drawing (connected and on screen). */
	isVisible: () => boolean;
	/** Draw the scene; the host has already set viewport, scissor and cleared. */
	draw: (renderer: THREE.WebGLRenderer) => void;
	/** `true` while the view wants continuous frames. */
	isAnimating: () => boolean;
}

/** The shared host's public surface. */
export interface ThreeRendererHost {
	/** `false` when WebGL could not be initialised at all (caller falls back to 2D). */
	readonly available: boolean;
	register: (view: HostedView) => void;
	unregister: (view: HostedView) => void;
	requestRender: (view: HostedView) => void;
	/** Draw every pending view immediately (tests, export). */
	flushNow: () => void;
	/** Draw one registered view immediately, even when it is off screen (export snapshots). */
	drawNow: (view: HostedView) => void;
}

interface HostState {
	three: ThreeModule;
	renderer: THREE.WebGLRenderer | null;
	views: Set<HostedView>;
	dirty: Set<HostedView>;
	frame: number;
	lost: boolean;
	bufferWidth: number;
	bufferHeight: number;
}

function createRenderer(three: ThreeModule, state: HostState): THREE.WebGLRenderer | null {
	try {
		const renderer = new three.WebGLRenderer({
			antialias: true,
			alpha: true,
			premultipliedAlpha: false,
			powerPreference: 'default',
		});
		renderer.setPixelRatio(1);
		renderer.outputColorSpace = three.SRGBColorSpace;
		renderer.autoClear = false;
		const canvas = renderer.domElement;
		canvas.addEventListener('webglcontextlost', (event) => {
			event.preventDefault();
			state.lost = true;
		});
		canvas.addEventListener('webglcontextrestored', () => {
			state.lost = false;
			for (const view of state.views) {
				state.dirty.add(view);
			}
			schedule(state);
		});
		return renderer;
	} catch {
		return null;
	}
}

/** Grow (never shrink) the shared drawing buffer so it can hold a `width` x `height` view. */
function ensureBuffer(state: HostState, width: number, height: number): void {
	const renderer = state.renderer;
	if (!renderer || (width <= state.bufferWidth && height <= state.bufferHeight)) {
		return;
	}
	state.bufferWidth = Math.min(MAX_VIEW_PIXELS, Math.max(state.bufferWidth, width));
	state.bufferHeight = Math.min(MAX_VIEW_PIXELS, Math.max(state.bufferHeight, height));
	renderer.setSize(state.bufferWidth, state.bufferHeight, false);
}

function drawView(state: HostState, view: HostedView): void {
	const renderer = state.renderer;
	if (!renderer) {
		return;
	}
	const size = view.pixelSize();
	const width = Math.max(1, Math.min(MAX_VIEW_PIXELS, Math.round(size.width)));
	const height = Math.max(1, Math.min(MAX_VIEW_PIXELS, Math.round(size.height)));
	ensureBuffer(state, width, height);
	// WebGL's viewport origin is bottom-left; anchoring the view at the TOP of
	// the buffer means the pixels land at source (0, 0) for drawImage below.
	const y = state.bufferHeight - height;
	renderer.setViewport(0, y, width, height);
	renderer.setScissor(0, y, width, height);
	renderer.setScissorTest(true);
	renderer.setClearColor(0x000000, 0);
	renderer.clear(true, true, true);
	view.draw(renderer);

	const target = view.canvas;
	if (target.width !== width || target.height !== height) {
		target.width = width;
		target.height = height;
	}
	const ctx = target.getContext('2d');
	if (!ctx) {
		return;
	}
	ctx.clearRect(0, 0, width, height);
	ctx.drawImage(renderer.domElement, 0, 0, width, height, 0, 0, width, height);
}

function flush(state: HostState): void {
	state.frame = 0;
	if (state.lost || !state.renderer) {
		return;
	}
	const pending = [...state.dirty];
	state.dirty.clear();
	for (const view of pending) {
		if (!state.views.has(view)) {
			continue;
		}
		if (!view.isVisible()) {
			// Remember it: it draws as soon as it becomes visible again.
			state.dirty.add(view);
			continue;
		}
		try {
			drawView(state, view);
		} catch (error) {
			// One broken scene must never stop every other view from drawing.
			console.error('[pptx-three-view] scene render failed', error);
			continue;
		}
		if (view.isAnimating()) {
			state.dirty.add(view);
		}
	}
	const anyVisibleDirty = [...state.dirty].some((v) => v.isVisible());
	if (anyVisibleDirty) {
		schedule(state);
	}
}

function schedule(state: HostState): void {
	if (state.frame !== 0 || typeof requestAnimationFrame === 'undefined') {
		return;
	}
	state.frame = requestAnimationFrame(() => flush(state));
}

let sharedHost: ThreeRendererHost | null = null;

/**
 * The page-wide renderer host, created on first use from the given `three`
 * module. Every later call returns the same host, whatever module it passes.
 */
export function getThreeRendererHost(three: ThreeModule): ThreeRendererHost {
	if (sharedHost) {
		return sharedHost;
	}
	const state: HostState = {
		three,
		renderer: null,
		views: new Set(),
		dirty: new Set(),
		frame: 0,
		lost: false,
		bufferWidth: 0,
		bufferHeight: 0,
	};
	state.renderer = createRenderer(three, state);
	const host: ThreeRendererHost = {
		available: state.renderer !== null,
		register(view) {
			state.views.add(view);
			state.dirty.add(view);
			schedule(state);
		},
		unregister(view) {
			state.views.delete(view);
			state.dirty.delete(view);
		},
		requestRender(view) {
			if (!state.views.has(view)) {
				return;
			}
			state.dirty.add(view);
			schedule(state);
		},
		flushNow() {
			if (state.frame !== 0 && typeof cancelAnimationFrame !== 'undefined') {
				cancelAnimationFrame(state.frame);
			}
			flush(state);
		},
		drawNow(view) {
			if (state.lost || !state.renderer || !state.views.has(view)) {
				return;
			}
			state.dirty.delete(view);
			try {
				drawView(state, view);
			} catch (error) {
				console.error('[pptx-three-view] scene render failed', error);
			}
		},
	};
	sharedHost = host;
	return host;
}

/** Test hook: forget the shared host so the next call builds a fresh one. */
export function resetThreeRendererHostForTests(): void {
	sharedHost = null;
}
