/**
 * `chart-gridlines-toggle` - read/write helpers for the inspector's simple
 * "Show Gridlines" checkbox (`ChartDisplayOptions` in React/Vue/Angular,
 * the inline checkbox in Svelte's `ChartSection`).
 *
 * WHY this exists: every binding wired that checkbox straight to
 * `style.hasGridlines`, a field the renderer never reads. Actual gridline
 * visibility comes from the value axis's `majorGridlines` flag
 * (`c:valAx/c:majorGridlines`, see `chart-axis-render.ts` /
 * `chart-cartesian-axes.ts`), which the checkbox never touched. So toggling
 * "Show Gridlines" silently did nothing.
 *
 * {@link chartGridlinesState} and {@link chartGridlinesPatch} read and write
 * the primary value axis's `majorGridlines` instead, creating a minimal
 * `valAx` entry when the chart has none yet. `style.hasGridlines` is still
 * kept in sync for any legacy reader of that field (e.g. a converter that has
 * not been updated to look at the axis).
 *
 * @module render/chart-gridlines-toggle
 */
import type { PptxChartAxisFormatting, PptxChartData } from 'pptx-viewer-core';

/**
 * Find the chart's primary (non-secondary) value axis: the one positioned
 * "l" (left), or the first `valAx` entry when none declares a position.
 * Mirrors `getPrimaryValueAxisId` in `chart-axis.ts`.
 */
function primaryValueAxis(
	axes: PptxChartAxisFormatting[] | undefined,
): PptxChartAxisFormatting | undefined {
	if (!axes) {
		return undefined;
	}
	return (
		axes.find((axis) => axis.axisType === 'valAx' && axis.axPos === 'l') ??
		axes.find((axis) => axis.axisType === 'valAx')
	);
}

/**
 * Whether the chart's primary value axis currently shows major gridlines.
 *
 * A parsed value axis is authoritative: `c:majorGridlines` present means
 * shown, absent means hidden, exactly as PowerPoint renders it. A chart with
 * no parsed value axis (SDK/AI-created, never saved) falls back to the legacy
 * `style.hasGridlines` flag and then to `true`, because that is what the
 * renderer draws for such a chart (PowerPoint's own default chart has major
 * gridlines), so the checkbox and the canvas agree.
 *
 * This is also the renderer's decision ({@link shouldRenderMajorGridlines});
 * the two are one function so the inspector can never disagree with the
 * canvas.
 */
export function chartGridlinesState(chartData: PptxChartData): boolean {
	const axis = primaryValueAxis(chartData.axes);
	if (axis) {
		return axis.majorGridlines ?? false;
	}
	return chartData.style?.hasGridlines ?? true;
}

/** Whether the cartesian renderer should draw primary major gridlines. */
export const shouldRenderMajorGridlines = chartGridlinesState;

/**
 * Build a `Partial<PptxChartData>` patch that toggles major gridlines on the
 * primary value axis, creating a minimal `valAx` entry when the chart's
 * `axes` array has none. Also updates `style.hasGridlines` to the same value
 * so a legacy reader of that field stays consistent.
 */
export function chartGridlinesPatch(
	chartData: PptxChartData,
	show: boolean,
): Partial<PptxChartData> {
	const axes = chartData.axes ? [...chartData.axes] : [];
	let index = axes.findIndex((axis) => axis.axisType === 'valAx' && axis.axPos === 'l');
	if (index === -1) {
		index = axes.findIndex((axis) => axis.axisType === 'valAx');
	}
	if (index === -1) {
		axes.push({ axisType: 'valAx', majorGridlines: show });
	} else {
		axes[index] = { ...axes[index], majorGridlines: show };
	}
	return {
		axes,
		style: { ...chartData.style, hasGridlines: show },
	};
}
