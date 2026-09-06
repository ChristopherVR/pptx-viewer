/**
 * useAreaChart3dScene: Vue composable that drives the shared vanilla-three
 * {@link mountAreaChart3D} controller for an area3D chart's interactive WebGL
 * view. Mirrors {@link ./useBarChart3dScene.ts} exactly, swapping the box-mesh
 * layout for a pre-built per-series path + ribbon layout ({@link AreaChart3DSceneOptions}
 * from `buildAreaChart3DDataForElement`).
 *
 * See {@link ./useLineChart3dScene.ts} for the full responsibility rundown;
 * this composable is identical except for which shared mount function it
 * drives, including the click/drag-to-value bridge to the SAME chart-part
 * selection + commit path the 2D SVG mark interaction uses, and the
 * text-style emphasis wiring onto the scene's own axis labels.
 */
import type { PptxChartData } from 'pptx-viewer-core';
import { formatAxisValue, mountAreaChart3D } from 'pptx-viewer-shared';
import type {
	AreaChart3DHandle,
	AreaChart3DSceneOptions,
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

/** Reactive inputs to {@link useAreaChart3dScene}. */
export interface UseAreaChart3dSceneOptions {
	/** Container the scene's canvas is appended into; may be null pre-mount. */
	container: Ref<HTMLElement | null>;
	/** The path layout to mount, or null when the chart has no plottable data. */
	options: Ref<AreaChart3DSceneOptions | null>;
	/** The owning chart element's id: selection scoping + the commit path. */
	elementId: () => string;
	/** The committed chart data, for building the value-drag commit patch. */
	chartData: () => PptxChartData | undefined;
	/** Active font-style emphasis override for the scene's own axis labels. */
	textStyle?: Ref<TextStyleAnimationDescriptor | undefined>;
}

/** Result of {@link useAreaChart3dScene}. */
export interface UseAreaChart3dSceneResult {
	/** True once an interactive scene has actually mounted (three available). */
	mounted: Ref<boolean>;
	/** True while a mount attempt (three.js probe + scene setup) is in flight. */
	loading: Ref<boolean>;
	/** Formatted value for the mid-drag badge, or null when not dragging. */
	dragLabel: ComputedRef<string | null>;
}

/**
 * Mount and manage the shared 3D scene for an area3D chart. See module doc.
 */
export function useAreaChart3dScene(opts: UseAreaChart3dSceneOptions): UseAreaChart3dSceneResult {
	const { container, options, elementId, chartData, textStyle } = opts;
	const ctx = injectChartCanvasEdit();
	const mounted = ref(false);
	const loading = ref(false);
	const dragValue = ref<number | null>(null);
	const dragLabel = computed(() =>
		dragValue.value === null ? null : formatAxisValue(dragValue.value),
	);

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
		const sceneOptions: AreaChart3DSceneOptions = { ...series, textStyle: textStyle?.value };
		void mountAreaChart3D(host, sceneOptions, {
			onSelect: (part) => onChart3DSelect(ctx, elementId(), part),
			onValueDragPreview: (_part, value) => {
				dragValue.value = value;
			},
			onValueDragCommit: (part, value) => {
				dragValue.value = null;
				onChart3DValueDragCommit(ctx, elementId(), chartData(), part, value);
			},
		}).then((next) => {
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
