/**
 * useSurfaceChart3dScene: Vue composable that drives the shared vanilla-three
 * {@link mountSurfaceChart3D} controller for a surface chart's interactive
 * WebGL view. Mirrors {@link ./useBarChart3dScene.ts} exactly, swapping the
 * box-mesh layout for a pre-built grid ({@link SurfaceChart3DSceneOptions}
 * from `buildSurfaceChart3DDataForElement`).
 *
 * Responsibilities (the framework-coupled glue the SFC should stay free of):
 * - mount the shared scene into a caller-provided container ref whenever grid
 *   data exists, three.js is available, and the container is attached;
 * - expose whether the scene actually mounted (`mounted`) so the SFC can fall
 *   back to the SVG renderer when three.js is absent or the chart has no
 *   plottable grid;
 * - expose whether a mount attempt is in flight (`loading`) so the SFC can
 *   show a lightweight spinner instead of flashing the SVG fallback while
 *   three.js is still loading;
 * - dispose the live handle on teardown or whenever `options` changes identity
 *   (including a resize: `buildSurfaceChart3DDataForElement` is a pure
 *   function that returns a fresh object on every call, so a size-only change
 *   is indistinguishable from a data change here and remounts like one; this
 *   mirrors the React/Angular ports, which have the same property).
 * - wire the mounted scene's own click/drag picking to the SAME chart-part
 *   selection + commit path the 2D SVG mark interaction uses, via
 *   `chart-3d-interaction-support`, so the chart inspector reacts to a
 *   selected/dragged vertex exactly like a 2D mark; and apply the active
 *   text-style emphasis override to the scene's own axis labels.
 *
 * `three` is an optional peer dependency; it is only ever imported dynamically
 * inside the shared module, so this composable adds nothing to the bundle when
 * the consumer does not install it.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { formatAxisValue, mountSurfaceChart3D } from 'pptx-viewer-shared';
import type {
	SurfaceChart3DHandle,
	SurfaceChart3DSceneOptions,
	TextStyleAnimationDescriptor,
} from 'pptx-viewer-shared';
import { computed, onScopeDispose, ref, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import {
	onChart3DSelect,
	onChart3DValueDragCommit,
	selectedChart3DPart,
} from './chart-3d-interaction-support';
import { injectChartCanvasEdit } from './chart-part-selection';

/** Reactive inputs to {@link useSurfaceChart3dScene}. */
export interface UseSurfaceChart3dSceneOptions {
	/** Container the scene's canvas is appended into; may be null pre-mount. */
	container: Ref<HTMLElement | null>;
	/** The grid to mount, or null when the chart has no plottable data. */
	options: Ref<SurfaceChart3DSceneOptions | null>;
	/** The owning chart element's id: selection scoping + the commit path. */
	elementId: () => string;
	/** The committed chart data, for building the value-drag commit patch. */
	chartData: () => PptxChartData | undefined;
	/** Active font-style emphasis override for the scene's own axis labels. */
	textStyle?: Ref<TextStyleAnimationDescriptor | undefined>;
}

/** Result of {@link useSurfaceChart3dScene}. */
export interface UseSurfaceChart3dSceneResult {
	/** True once an interactive scene has actually mounted (three available). */
	mounted: Ref<boolean>;
	/** True while a mount attempt (three.js probe + scene setup) is in flight. */
	loading: Ref<boolean>;
	/** Formatted value for the mid-drag badge, or null when not dragging. */
	dragLabel: ComputedRef<string | null>;
}

/**
 * Mount and manage the shared 3D scene for a surface chart. See module doc.
 */
export function useSurfaceChart3dScene(
	opts: UseSurfaceChart3dSceneOptions,
): UseSurfaceChart3dSceneResult {
	const { container, options, elementId, chartData, textStyle } = opts;
	const ctx = injectChartCanvasEdit();
	const mounted = ref(false);
	const loading = ref(false);
	const dragValue = ref<number | null>(null);
	const dragLabel = computed(() =>
		dragValue.value === null ? null : formatAxisValue(dragValue.value),
	);

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
			loading.value = false;
			return;
		}

		loading.value = true;
		const sceneOptions: SurfaceChart3DSceneOptions = { ...grid, textStyle: textStyle?.value };
		void mountSurfaceChart3D(host, sceneOptions, {
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

	// Remount when the grid data (or container) identity changes.
	watch([options, container], remount, { immediate: true });

	// Re-apply the selected-part highlight when selection changes from OUTSIDE
	// this scene (the inspector, keyboard, or another element being selected).
	watch(
		() => selectedChart3DPart(ctx, elementId()),
		(part) => handle?.setSelectedPart(part),
	);

	if (textStyle) {
		watch(textStyle, (style) => handle?.setTextStyle(style));
	}

	onScopeDispose(() => {
		mountToken++;
		disposeHandle();
	});

	return { mounted, loading, dragLabel };
}
