/**
 * usePieChart3dScene: Vue composable that drives the shared vanilla-three
 * {@link mountPieChart3D} controller for a pie3D chart's interactive WebGL
 * view. Mirrors {@link ./useBarChart3dScene.ts} exactly, swapping the box-mesh
 * layout for a pre-built wedge-mesh layout ({@link PieChart3DSceneOptions}
 * from `buildPieChart3DDataForElement`).
 *
 * Responsibilities (the framework-coupled glue the SFC should stay free of):
 * - mount the shared scene into a caller-provided container ref whenever
 *   wedge data exists, three.js is available, and the container is attached;
 * - expose whether the scene actually mounted (`mounted`) so the SFC can fall
 *   back to the SVG renderer when three.js is absent or the chart has no
 *   plottable series;
 * - dispose the live handle on teardown or whenever `options` changes identity
 *   (including a resize: `buildPieChart3DDataForElement` is a pure function
 *   that returns a fresh object on every call, so a size-only change is
 *   indistinguishable from a data change here and remounts like one; this
 *   mirrors the bar-chart composable's same property).
 *
 * `three` is an optional peer dependency; it is only ever imported dynamically
 * inside the shared module, so this composable adds nothing to the bundle when
 * the consumer does not install it.
 */
import { mountPieChart3D } from 'pptx-viewer-shared';
import type { PieChart3DHandle, PieChart3DSceneOptions } from 'pptx-viewer-shared';
import { onScopeDispose, ref, watch } from 'vue';
import type { Ref } from 'vue';

/** Reactive inputs to {@link usePieChart3dScene}. */
export interface UsePieChart3dSceneOptions {
	/** Container the scene's canvas is appended into; may be null pre-mount. */
	container: Ref<HTMLElement | null>;
	/** The wedge layout to mount, or null when the chart has no plottable data. */
	options: Ref<PieChart3DSceneOptions | null>;
}

/** Result of {@link usePieChart3dScene}. */
export interface UsePieChart3dSceneResult {
	/** True once an interactive scene has actually mounted (three available). */
	mounted: Ref<boolean>;
	/** True while a mount attempt (three.js probe + scene setup) is in flight. */
	loading: Ref<boolean>;
}

/**
 * Mount and manage the shared 3D scene for a pie3D chart. See module doc.
 */
export function usePieChart3dScene(opts: UsePieChart3dSceneOptions): UsePieChart3dSceneResult {
	const { container, options } = opts;
	const mounted = ref(false);
	const loading = ref(false);

	let handle: PieChart3DHandle | null = null;
	// Monotonic token so a slow mount() that resolves after teardown / newer
	// data is discarded instead of clobbering the current handle.
	let mountToken = 0;

	function disposeHandle(): void {
		handle?.dispose();
		handle = null;
		mounted.value = false;
	}

	/** Tear down the scene, then mount afresh for the current wedge data. */
	function remount(): void {
		const token = ++mountToken;
		disposeHandle();

		const wedges = options.value;
		const host = container.value;
		if (!wedges || !host) {
			loading.value = false;
			return;
		}

		loading.value = true;
		void mountPieChart3D(host, wedges).then((next) => {
			// Stale resolution: a newer remount (or teardown) ran meanwhile.
			if (token !== mountToken) {
				next.dispose();
				return undefined;
			}
			handle = next;
			mounted.value = next.ok;
			loading.value = false;
			return undefined;
		});
	}

	// Remount when the wedge data (or container) identity changes.
	watch([options, container], remount, { immediate: true });

	onScopeDispose(() => {
		mountToken++;
		disposeHandle();
	});

	return { mounted, loading };
}
