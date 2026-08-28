/**
 * useAreaChart3dScene: Vue composable that drives the shared vanilla-three
 * {@link mountAreaChart3D} controller for an area3D chart's interactive WebGL
 * view. Mirrors {@link ./useBarChart3dScene.ts} exactly, swapping the box-mesh
 * layout for a pre-built per-series path + ribbon layout ({@link AreaChart3DSceneOptions}
 * from `buildAreaChart3DDataForElement`).
 *
 * See {@link ./useLineChart3dScene.ts} for the full responsibility rundown;
 * this composable is identical except for which shared mount function it
 * drives.
 */
import { mountAreaChart3D } from 'pptx-viewer-shared';
import type { AreaChart3DHandle, AreaChart3DSceneOptions } from 'pptx-viewer-shared';
import { onScopeDispose, ref, watch } from 'vue';
import type { Ref } from 'vue';

/** Reactive inputs to {@link useAreaChart3dScene}. */
export interface UseAreaChart3dSceneOptions {
	/** Container the scene's canvas is appended into; may be null pre-mount. */
	container: Ref<HTMLElement | null>;
	/** The path layout to mount, or null when the chart has no plottable data. */
	options: Ref<AreaChart3DSceneOptions | null>;
}

/** Result of {@link useAreaChart3dScene}. */
export interface UseAreaChart3dSceneResult {
	/** True once an interactive scene has actually mounted (three available). */
	mounted: Ref<boolean>;
	/** True while a mount attempt (three.js probe + scene setup) is in flight. */
	loading: Ref<boolean>;
}

/**
 * Mount and manage the shared 3D scene for an area3D chart. See module doc.
 */
export function useAreaChart3dScene(opts: UseAreaChart3dSceneOptions): UseAreaChart3dSceneResult {
	const { container, options } = opts;
	const mounted = ref(false);
	const loading = ref(false);

	let handle: AreaChart3DHandle | null = null;
	let mountToken = 0;

	function disposeHandle(): void {
		handle?.dispose();
		handle = null;
		mounted.value = false;
	}

	function remount(): void {
		const token = ++mountToken;
		disposeHandle();

		const series = options.value;
		const host = container.value;
		if (!series || !host) {
			loading.value = false;
			return;
		}

		loading.value = true;
		void mountAreaChart3D(host, series).then((next) => {
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

	watch([options, container], remount, { immediate: true });

	onScopeDispose(() => {
		mountToken++;
		disposeHandle();
	});

	return { mounted, loading };
}
