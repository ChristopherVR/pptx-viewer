<script lang="ts">
	/**
	 * ChartSection: the chart inspector body, mirroring React's
	 * `inspector/ChartDataPanel.tsx` composition.
	 *
	 * Order matches React: type + title + display toggles, then the
	 * spreadsheet-style {@link ChartDataGrid}, then per-series styling, axes,
	 * {@link ChartErrorBarSection}, and the advanced disclosures.
	 *
	 * The old comma-joined "series values" text input is kept alongside the grid
	 * because it remains the fastest way to paste a whole row; the grid is what
	 * makes a single cell editable without retyping the rest.
	 */
	import type {
		ChartPptxElement,
		PptxChartAxisFormatting,
		PptxChartData,
		PptxChartErrBars,
		PptxChartMarkerSymbol,
		PptxChartSeries,
		PptxChartTrendline,
	} from 'pptx-viewer-core';
	import { setChartDataPointMarker } from 'pptx-viewer-core';
	import type { ChartTypeSelectValue } from 'pptx-viewer-shared';
	import {
		bar3DShapePatch,
		BAR3D_SHAPE_OPTIONS,
		CHART_TYPE_LABEL_KEYS,
		CHART_TYPE_OPTIONS,
		collapseChartTitleRunsForEdit,
		patchChartData as sharedPatchChartData,
		radarStylePatch,
		RADAR_STYLE_OPTIONS,
		resolveDisplayedChartType,
		schemaLabel,
		surfaceWireframePatch,
		SURFACE_WIREFRAME_OPTIONS,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import ChartAdvancedSection from './ChartAdvancedSection.svelte';
	import ChartAxisFormatSection from './ChartAxisFormatSection.svelte';
	import ChartDataGrid from './ChartDataGrid.svelte';
	import ChartErrorBarSection from './ChartErrorBarSection.svelte';
	import ChartLabelsAxesSection from './ChartLabelsAxesSection.svelte';
	import ChartPointMarkerSection from './ChartPointMarkerSection.svelte';
	import ChartTrendlineSection from './ChartTrendlineSection.svelte';
	import ChartUserShapeSection from './ChartUserShapeSection.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	/**
	 * The chart types this select offers, derived from the same
	 * `CHART_TYPE_OPTIONS` catalogue Vue and Angular's chart-type selects
	 * consume (React re-exports it too). A hand-spelled copy here used to omit
	 * histogram, boxWhisker and regionMap, and separately drifted ahead of the
	 * other three bindings by hand-adding funnel/treemap/sunburst; deriving
	 * from the shared list means every future addition reaches this panel too.
	 */
	const chartTypes: readonly ChartTypeSelectValue[] = CHART_TYPE_OPTIONS.map((opt) => opt.value);
	const chart = $derived(
		editor.selectedElement?.type === 'chart' ? editor.selectedElement : undefined,
	);
	const data = $derived(chart?.chartData);
	const canEdit = $derived(editor.editable);
	/**
	 * The type shown as selected. "Pareto" has no `PptxChartType` of its own
	 * (docs/guide/limitations.md's ChartEx row): it is `chartType: 'histogram'`
	 * plus a `paretoLine`-layout series, so reading `data.chartType` raw would
	 * show "Histogram" for a chart the user picked "Pareto" for.
	 */
	const displayedType = $derived(data ? resolveDisplayedChartType(data) : undefined);

	function patch(next: Partial<PptxChartData>): void {
		if (chart && data) {
			editor.applyElementPatch(chart.id, { chartData: { ...data, ...next } });
		}
	}
	/**
	 * Chart-type select handler: routed through the shared `patchChartData`
	 * (not the plain `patch` merge above) so a type change clears grouping the
	 * new type doesn't support and adapts the category/series shape, exactly
	 * like React/Vue/Angular's chart-type selectors. This is also what makes
	 * `'pareto'` work: it has no `PptxChartType` of its own (see
	 * docs/guide/limitations.md's ChartEx row), so only `patchChartData` knows
	 * how to convert it to `chartType: 'histogram'` plus a cumulative-percent
	 * series.
	 */
	function onTypeChange(value: ChartTypeSelectValue): void {
		if (data) {
			replace(sharedPatchChartData(data, { chartType: value }));
		}
	}
	/** Replace the whole chart-data object (used by the grid's structural edits). */
	function replace(next: PptxChartData): void {
		if (chart) {
			editor.applyElementPatch(chart.id, { chartData: next });
		}
	}
	function seriesPatch(index: number, next: Partial<PptxChartSeries>): void {
		if (data) {
			patch({ series: data.series.map((series, i) => (i === index ? { ...series, ...next } : series)) });
		}
	}
	function seriesColorPatch(index: number, color: string): void {
		seriesPatch(index, { color });
		editor.recordRecentColor(color);
	}
	function axisPatch(index: number, next: Partial<PptxChartAxisFormatting>): void {
		if (data) {
			patch({ axes: (data.axes ?? []).map((axis, i) => (i === index ? { ...axis, ...next } : axis)) });
		}
	}
	/** Set or clear one series' error bars (core stores them as a 1-item array). */
	function setErrorBars(index: number, errBars: PptxChartErrBars | null): void {
		seriesPatch(index, { errBars: errBars ? [errBars] : undefined });
	}
	/**
	 * Set or clear one series' trendline. Clearing writes an EMPTY array, not
	 * `undefined`: the save serializer treats `undefined` as "not modelled, leave
	 * the XML alone", so a removed trendline would come straight back on reload.
	 */
	function setTrendline(index: number, trendline: PptxChartTrendline | null): void {
		seriesPatch(index, { trendlines: trendline ? [trendline] : [] });
	}
	/**
	 * Set or clear a per-point marker override through core's headless op, which
	 * mutates in place: run it over a deep clone so the editor sees a fresh
	 * reference (Svelte's `$state` proxies compare by identity) and undo stays a
	 * single, self-contained step.
	 */
	function setPointMarker(
		seriesIndex: number,
		pointIndex: number,
		marker: { symbol?: PptxChartMarkerSymbol; size?: number; fillColor?: string } | null,
	): void {
		if (!chart || !data) {
			return;
		}
		const clone: ChartPptxElement = { ...chart, chartData: structuredClone($state.snapshot(data)) };
		setChartDataPointMarker(clone, seriesIndex, pointIndex, marker);
		replace(clone.chartData!);
	}

	/**
	 * The three chart-subtype pickers (wave 4 #1): `bar3DShapePatch` /
	 * `radarStylePatch` / `surfaceWireframePatch` are pure decision functions
	 * from shared, each returning `{}` when the current chart type does not
	 * match, so a stray call is always harmless.
	 */
	function onBar3DShapeChange(value: string): void {
		if (data) {
			patch(bar3DShapePatch(data, value as (typeof BAR3D_SHAPE_OPTIONS)[number]['value']));
		}
	}
	function onRadarStyleChange(value: string): void {
		if (data) {
			patch(radarStylePatch(data, value as (typeof RADAR_STYLE_OPTIONS)[number]['value']));
		}
	}
	function onSurfaceWireframeChange(value: string): void {
		if (data) {
			patch(surfaceWireframePatch(data, value === 'true'));
		}
	}
</script>

{#if data}<div class="section">
	<label>Chart type<select aria-label="Chart type" value={displayedType} onchange={(event) => onTypeChange(event.currentTarget.value as ChartTypeSelectValue)}>{#each chartTypes as type}<option value={type}>{schemaLabel(CHART_TYPE_LABEL_KEYS, type, t)}</option>{/each}</select></label>
	<label>Title<input value={data.title ?? ''} oninput={(event) => patch({ ...collapseChartTitleRunsForEdit(data, event.currentTarget.value), style: { ...data.style, hasTitle: Boolean(event.currentTarget.value) } })} /></label>
	<div class="checks"><label><input type="checkbox" checked={data.style?.hasLegend ?? false} onchange={(event) => patch({ style: { ...data.style, hasLegend: event.currentTarget.checked } })} />Legend</label><label><input type="checkbox" checked={data.style?.hasDataLabels ?? false} onchange={(event) => patch({ style: { ...data.style, hasDataLabels: event.currentTarget.checked } })} />Data labels</label><label><input type="checkbox" checked={data.style?.hasGridlines ?? false} onchange={(event) => patch({ style: { ...data.style, hasGridlines: event.currentTarget.checked } })} />Gridlines</label>
		{#if data.chartType === 'bar3D'}
			<label>{t('pptx.chart.bar3DShapeLabel')}<select aria-label={t('pptx.chart.bar3DShapeLabel')} data-testid="pptx-chart-bar3d-shape" value={data.barShape ?? 'box'} onchange={(event) => onBar3DShapeChange(event.currentTarget.value)}>{#each BAR3D_SHAPE_OPTIONS as option (option.value)}<option value={option.value}>{t(option.labelKey)}</option>{/each}</select></label>
		{/if}
		{#if data.chartType === 'radar'}
			<label>{t('pptx.chart.radarStyleLabel')}<select aria-label={t('pptx.chart.radarStyleLabel')} data-testid="pptx-chart-radar-style" value={data.radarStyle ?? 'standard'} onchange={(event) => onRadarStyleChange(event.currentTarget.value)}>{#each RADAR_STYLE_OPTIONS as option (option.value)}<option value={option.value}>{t(option.labelKey)}</option>{/each}</select></label>
		{/if}
		{#if data.chartType === 'surface'}
			<label>{t('pptx.chart.surfaceWireframeLabel')}<select aria-label={t('pptx.chart.surfaceWireframeLabel')} data-testid="pptx-chart-surface-wireframe" value={data.wireframe ? 'true' : 'false'} onchange={(event) => onSurfaceWireframeChange(event.currentTarget.value)}>{#each SURFACE_WIREFRAME_OPTIONS as option (option.value)}<option value={option.value}>{t(option.labelKey)}</option>{/each}</select></label>
		{/if}
	</div>
	<ChartDataGrid
		{data}
		{canEdit}
		onreplace={replace}
		onrenameseries={(index, name) => seriesPatch(index, { name })}
	/>
	<h5>Series</h5>{#each data.series as series, index}<fieldset><input aria-label="Series name" value={series.name} oninput={(event) => seriesPatch(index, { name: event.currentTarget.value })} /><input aria-label="Series values" value={series.values.join(', ')} onchange={(event) => seriesPatch(index, { values: event.currentTarget.value.split(',').map(Number).filter(Number.isFinite) })} /><input type="color" aria-label="Series color" value={series.color ?? '#4472c4'} onchange={(event) => seriesColorPatch(index, event.currentTarget.value)} /></fieldset>{/each}
	<ChartTrendlineSection {data} {canEdit} onsettrendline={setTrendline} />
	{#if chart}<ChartPointMarkerSection {editor} element={chart} {canEdit} onsetpointmarker={setPointMarker} />{/if}
	<h5>Axes</h5>{#each data.axes ?? [] as axis, index}<fieldset><input aria-label="Axis title" value={axis.titleText ?? ''} oninput={(event) => axisPatch(index, { titleText: event.currentTarget.value })} /><input type="number" aria-label="Axis minimum" placeholder="Min" value={axis.min ?? ''} onchange={(event) => axisPatch(index, { min: event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) })} /><input type="number" aria-label="Axis maximum" placeholder="Max" value={axis.max ?? ''} onchange={(event) => axisPatch(index, { max: event.currentTarget.value === '' ? undefined : Number(event.currentTarget.value) })} /></fieldset>{/each}
	<ChartErrorBarSection {data} {canEdit} onseterrorbars={setErrorBars} />
	<ChartAxisFormatSection {data} {canEdit} onpatch={patch} />
	<ChartLabelsAxesSection {editor} {data} onpatch={patch} />
	<ChartAdvancedSection {editor} {data} onpatch={patch} />
	<ChartUserShapeSection {data} {canEdit} onpatch={patch} />
</div>{/if}

<style>.section{display:grid;gap:8px}label{display:grid;gap:3px;color:var(--pptx-muted-foreground);font-size:10px}input,select{min-width:0;height:26px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}.checks{display:grid;grid-template-columns:1fr 1fr;gap:5px}.checks label{display:flex;align-items:center}h5{margin:6px 0 0;font-size:10px;text-transform:uppercase}fieldset{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:0;padding:7px;border:1px solid var(--pptx-border);border-radius:6px}</style>
