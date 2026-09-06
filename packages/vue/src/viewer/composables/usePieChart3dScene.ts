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
 * - wire the mounted scene's own click/drag picking to the SAME chart-part
 *   selection + commit path the 2D SVG mark interaction uses
 *   (`chart-canvas-interaction.ts`), via `chart-3d-interaction-support`, so
 *   the chart inspector reacts to a 3D wedge exactly like a 2D slice: dragging
 *   a wedge sweeps its trailing edge around the pie's centre, renormalising
 *   every other slice's angle live, exactly like the flat SVG pie/doughnut's
 *   own on-canvas editing. Pie3D draws no axis labels, so unlike its
 *   bar/line/area/surface siblings it has no text-style emphasis wiring.
 *
 * `three` is an optional peer dependency; it is only ever imported dynamically
 * inside the shared module, so this composable adds nothing to the bundle when
 * the consumer does not install it.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { formatAxisValue, mountPieChart3D } from 'pptx-viewer-shared';
import type { PieChart3DHandle, PieChart3DSceneOptions } from 'pptx-viewer-shared';
import { computed, onScopeDispose, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import {
	onChart3DSelect,
	onChart3DValueDragCommit,
	selectedChart3DPart,
} from './chart-3d-interaction-support';
import { injectChartCanvasEdit } from './chart-part-selection';

/** Reactive inputs to {@link usePieChart3dScene}. */
export interface UsePieChart3dSceneOptions {
	/** Container the scene's canvas is appended into; may be null pre-mount. */
	container: Ref<HTMLElement | null>;
	/** The wedge layout to mount, or null when the chart has no plottable data. */
	options: Ref<PieChart3DSceneOptions | null>;
	/** The owning chart element's id: selection scoping + the commit path. */
	elementId: () => string;
	/** The committed chart data, for building the value-drag commit patch. */
	chartData: () => PptxChartData | undefined;
}

/** Result of {@link usePieChart3dScene}. */
export interface UsePieChart3dSceneResult {
	/** True once an interactive scene has actually mounted (three available). */
	mounted: Ref<boolean>;
	/** True while a mount attempt (three.js probe + scene setup) is in flight. */
	loading: Ref<boolean>;
	/** Formatted value for the mid-drag badge, or null when not dragging. */
	dragLabel: ComputedRef<string | null>;
}

/**
 * Mount and manage the shared 3D scene for a pie3D chart. See module doc.
 */
export function usePieChart3dScene(opts: UsePieChart3dSceneOptions): UsePieChart3dSceneResult {
	const { container, options, elementId, chartData } = opts;
	const ctx = injectChartCanvasEdit();
	const mounted = ref(false);
	const loading = ref(false);
	const dragValue = ref<number | null>(null);
	const dragLabel = computed(() =>
		dragValue.value === null ? null : formatAxisValue(dragValue.value),
	);

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
		void mountPieChart3D(host, wedges, {
			onSelect: (part) => onChart3DSelect(ctx, elementId(), part),
			onValueDragPreview: (_part, value) => {
				dragValue.value = value;
			},
			onValueDragCommit: (part, value) => {
				dragValue.value = null;
				onChart3DValueDragCommit(ctx, elementId(), chartData(), part, value);
			},
		}).then((next) => {
			// Stale resolution: a newer remount (or teardown) ran meanwhile.
			if (token !== mountToken) {
				next.dispose();
				return undefined;
			}
			handle = next;
			mounted.value = next.ok;
			loading.value = false;
			if (next.ok) {
				next.setSelectedPart(selectedChart3DPart(ctx, elementId()));
			}
			return undefined;
		});
	}

	// Remount when the wedge data (or container) identity changes.
	watch([options, container], remount, { immediate: true });

	// Re-apply the selected-part highlight when selection changes from OUTSIDE
	// this scene (the inspector, keyboard, or another element being selected).
	watch(
		() => selectedChart3DPart(ctx, elementId()),
		(part) => handle?.setSelectedPart(part),
	);

	onScopeDispose(() => {
		mountToken++;
		disposeHandle();
	});

	return { mounted, loading, dragLabel };
}
