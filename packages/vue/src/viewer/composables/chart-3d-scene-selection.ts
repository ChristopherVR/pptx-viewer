import type { PptxChartType } from 'pptx-viewer-core';
import type { SupportedChartKind } from 'pptx-viewer-shared';
import { computed, unref } from 'vue';
import type { ComputedRef } from 'vue';

import { useAreaChart3D } from './area-chart-3d';
import { useBarChart3D } from './bar-chart-3d';
import { useLineChart3D } from './line-chart-3d';
import { usePieChart3D } from './pie-chart-3d';
import { useSurfaceChart3D } from './surface-chart-3d';

/**
 * chart-3d-scene-selection: bundles the five opt-in interactive-3D injected
 * flags (`useSurfaceChart3D` et al.) with the chart-kind/type checks that gate
 * each one, so `ChartRenderer.vue`'s template only tests one boolean per 3D
 * renderer instead of two. Kept as its own composable purely to keep
 * `ChartRenderer.vue` under this repo's file-size guideline; the decisions
 * themselves are unchanged from before this extraction.
 *
 * Bar3D/line3D/area3D/pie3D are gated on the RAW `c:chartType`, not the
 * folded `chartKind`: `resolveChartKind` folds e.g. `bar`/`bar3D` onto the
 * same 'bar' kind, so a plain 2D chart must never pick up its 3D sibling
 * scene. Surface has no 2D/3D split in `c:chartType`, so it gates on
 * `chartKind` instead.
 */
export interface UseChart3DSceneSelectionInput {
	/** The shared engine's verdict on this chart's family. */
	chartKind: () => SupportedChartKind | 'unsupported';
	/** The raw authored `c:chartType`. */
	chartType: () => PptxChartType;
}

/** One flag per 3D chart renderer: true when it should mount instead of the SVG path. */
export interface UseChart3DSceneSelectionResult {
	showSurface3D: ComputedRef<boolean>;
	showBar3D: ComputedRef<boolean>;
	showLine3D: ComputedRef<boolean>;
	showArea3D: ComputedRef<boolean>;
	showPie3D: ComputedRef<boolean>;
}

export function useChart3DSceneSelection(
	input: UseChart3DSceneSelectionInput,
): UseChart3DSceneSelectionResult {
	// `unref`, not `.value`: production always provides a real `ComputedRef`,
	// but a test may `provide()` a raw boolean directly (relying on the
	// template's implicit ref-unwrap sugar the OLD inline `<script setup>`
	// locals got for free); `unref` is a no-op on a non-ref so both work here.
	const use3DSurface = useSurfaceChart3D();
	const use3DBar = useBarChart3D();
	const use3DLine = useLineChart3D();
	const use3DArea = useAreaChart3D();
	const use3DPie = usePieChart3D();

	return {
		showSurface3D: computed(() => unref(use3DSurface) && input.chartKind() === 'surface'),
		showBar3D: computed(() => unref(use3DBar) && input.chartType() === 'bar3D'),
		showLine3D: computed(() => unref(use3DLine) && input.chartType() === 'line3D'),
		showArea3D: computed(() => unref(use3DArea) && input.chartType() === 'area3D'),
		showPie3D: computed(() => unref(use3DPie) && input.chartType() === 'pie3D'),
	};
}
