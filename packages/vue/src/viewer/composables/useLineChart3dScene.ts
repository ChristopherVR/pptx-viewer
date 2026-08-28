/**
 * useLineChart3dScene: Vue composable that drives the shared vanilla-three
 * {@link mountLineChart3D} controller for a line3D chart's interactive WebGL
 * view. Mirrors {@link ./useBarChart3dScene.ts} exactly, swapping the box-mesh
 * layout for a pre-built per-series path layout ({@link LineChart3DSceneOptions}
 * from `buildLineChart3DDataForElement`).
 *
 * Responsibilities (the framework-coupled glue the SFC should stay free of):
 * - mount the shared scene into a caller-provided container ref whenever path
 *   data exists, three.js is available, and the container is attached;
 * - expose whether the scene actually mounted (`mounted`) so the SFC can fall
 *   back to the SVG renderer when three.js is absent or the chart has no
 *   plottable grid;
 * - dispose the live handle on teardown or whenever `options` changes identity
 *   (including a resize: `buildLineChart3DDataForElement` is a pure function
 *   that returns a fresh object on every call, so a size-only change is
 *   indistinguishable from a data change here and remounts like one).
 *
 * `three` is an optional peer dependency; it is only ever imported dynamically
 * inside the shared module, so this composable adds nothing to the bundle when
 * the consumer does not install it.
 */
import { mountLineChart3D } from 'pptx-viewer-shared';
import type { LineChart3DHandle, LineChart3DSceneOptions } from 'pptx-viewer-shared';
import { onScopeDispose, ref, watch } from 'vue';
import type { Ref } from 'vue';

/** Reactive inputs to {@link useLineChart3dScene}. */
export interface UseLineChart3dSceneOptions {
	/** Container the scene's canvas is appended into; may be null pre-mount. */
	container: Ref<HTMLElement | null>;
	/** The path layout to mount, or null when the chart has no plottable data. */
	options: Ref<LineChart3DSceneOptions | null>;
}

/** Result of {@link useLineChart3dScene}. */
export interface UseLineChart3dSceneResult {
	/** True once an interactive scene has actually mounted (three available). */
	mounted: Ref<boolean>;
}

/**
 * Mount and manage the shared 3D scene for a line3D chart. See module doc.
 */
export function useLineChart3dScene(opts: UseLineChart3dSceneOptions): UseLineChart3dSceneResult {
	const { container, options } = opts;
	const mounted = ref(false);

	let handle: LineChart3DHandle | null = null;
	// Monotonic token so a slow mount() that resolves after teardown / newer
	// data is discarded instead of clobbering the current handle.
	let mountToken = 0;

	function disposeHandle(): void {
		handle?.dispose();
		handle = null;
		mounted.value = false;
	}

	/** Tear down the scene, then mount afresh for the current path data. */
	function remount(): void {
		const token = ++mountToken;
		disposeHandle();

		const series = options.value;
		const host = container.value;
		if (!series || !host) {
			return;
		}

		void mountLineChart3D(host, series).then((next) => {
			// Stale resolution: a newer remount (or teardown) ran meanwhile.
			if (token !== mountToken) {
				next.dispose();
				return undefined;
			}
			handle = next;
			mounted.value = next.ok;
			return undefined;
		});
	}

	// Remount when the path data (or container) identity changes.
	watch([options, container], remount, { immediate: true });

	onScopeDispose(() => {
		mountToken++;
		disposeHandle();
	});

	return { mounted };
}
