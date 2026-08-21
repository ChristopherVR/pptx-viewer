/**
 * useSurfaceChart3dScene: Vue composable that drives the shared vanilla-three
 * {@link mountSurfaceChart3D} controller for a surface chart's interactive
 * WebGL view. Mirrors {@link ./useModel3dScene.ts} exactly, swapping the
 * blob-URL model source for a pre-built grid ({@link
 * SurfaceChart3DSceneOptions} from `buildSurfaceChart3DDataForElement`).
 *
 * Responsibilities (the framework-coupled glue the SFC should stay free of):
 * - mount the shared scene into a caller-provided container ref whenever grid
 *   data exists, three.js is available, and the container is attached;
 * - expose whether the scene actually mounted (`mounted`) so the SFC can fall
 *   back to the SVG renderer when three.js is absent or the chart has no
 *   plottable grid;
 * - dispose the live handle on teardown or whenever `options` changes identity
 *   (including a resize: `buildSurfaceChart3DDataForElement` is a pure
 *   function that returns a fresh object on every call, so a size-only change
 *   is indistinguishable from a data change here and remounts like one; this
 *   mirrors the React/Angular ports, which have the same property).
 *
 * `three` is an optional peer dependency; it is only ever imported dynamically
 * inside the shared module, so this composable adds nothing to the bundle when
 * the consumer does not install it.
 */
import { mountSurfaceChart3D } from 'pptx-viewer-shared';
import type { SurfaceChart3DHandle, SurfaceChart3DSceneOptions } from 'pptx-viewer-shared';
import { onScopeDispose, ref, watch } from 'vue';
import type { Ref } from 'vue';

/** Reactive inputs to {@link useSurfaceChart3dScene}. */
export interface UseSurfaceChart3dSceneOptions {
	/** Container the scene's canvas is appended into; may be null pre-mount. */
	container: Ref<HTMLElement | null>;
	/** The grid to mount, or null when the chart has no plottable data. */
	options: Ref<SurfaceChart3DSceneOptions | null>;
}

/** Result of {@link useSurfaceChart3dScene}. */
export interface UseSurfaceChart3dSceneResult {
	/** True once an interactive scene has actually mounted (three available). */
	mounted: Ref<boolean>;
}

/**
 * Mount and manage the shared 3D scene for a surface chart. See module doc.
 */
export function useSurfaceChart3dScene(
	opts: UseSurfaceChart3dSceneOptions,
): UseSurfaceChart3dSceneResult {
	const { container, options } = opts;
	const mounted = ref(false);

	let handle: SurfaceChart3DHandle | null = null;
	// Monotonic token so a slow mount() that resolves after teardown / newer
	// data is discarded instead of clobbering the current handle.
	let mountToken = 0;

	function disposeHandle(): void {
		handle?.dispose();
		handle = null;
		mounted.value = false;
	}

	/** Tear down the scene, then mount afresh for the current grid data. */
	function remount(): void {
		const token = ++mountToken;
		disposeHandle();

		const grid = options.value;
		const host = container.value;
		if (!grid || !host) {
			return;
		}

		void mountSurfaceChart3D(host, grid).then((next) => {
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

	// Remount when the grid data (or container) identity changes.
	watch([options, container], remount, { immediate: true });

	onScopeDispose(() => {
		mountToken++;
		disposeHandle();
	});

	return { mounted };
}
