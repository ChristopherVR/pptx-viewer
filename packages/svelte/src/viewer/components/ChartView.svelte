<script lang="ts">
	/**
	 * ChartView: renders `chart` elements as an inline SVG projected from the
	 * shared `buildChartViewModel` engine (Svelte port of the vanilla / Vue
	 * chart projector). Covers every kind the shared engine builds (bar /
	 * column / line / area / scatter / bubble / pie / doughnut / radar plus
	 * combo, stock, surface, treemap, waterfall, regionMap, funnel, sunburst,
	 * histogram, boxWhisker), with axes / gridlines / labels / legend and the
	 * palette resolution order (explicit parsed palette, then style-id
	 * palette). Unsupported chart types and charts without series data render
	 * a labelled placeholder box. All maths live in `render/chart-view.ts` +
	 * `pptx-viewer-shared`; this SFC only emits SVG.
	 */
	import type { ChartPptxElement } from 'pptx-viewer-core';
	import { canDrillDown, resolveRevealedChartData } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { buildChartView, buildLegendItems } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import { BarFacePictureSampleVersion } from './bar-face-picture-sample.svelte';
	import ChartSvgView from './ChartSvgView.svelte';
	import { ChartDragController } from './chart-drag.svelte';
	import type { ElementRendererProps } from './props';

	const { element, zIndex, animationState, interactive = false, marked = false, selected = false, onchartpointcommit }: ElementRendererProps = $props();
	const t = useTranslator();

	/**
	 * Direct on-canvas editing is live only on the editable canvas: the stage
	 * passes `onchartpointcommit` there and nowhere else, so thumbnails and the
	 * presentation surface keep inert charts.
	 */
	let rootEl = $state<HTMLElement | null>(null);
	let titleInputEl = $state<HTMLInputElement | null>(null);
	// G8: `a:graphicFrameLocks/@noDrilldown` forbids entering this chart's
	// individual parts (title, series, data points) for editing.
	const editable = $derived(
		interactive && Boolean(onchartpointcommit) && element.type === 'chart' && canDrillDown(element),
	);
	/**
	 * The marks are pointer-armed (`pptx-chart-interactive`) only while the
	 * chart itself is SELECTED, matching React (`render/chart-canvas-drag`'s
	 * contract). Armed whenever the canvas was merely editable, a mark's own
	 * `stopPropagation` on pointerdown ate the first click on an unselected
	 * chart before it ever reached the element-selection handler, so a chart
	 * with no prior selection could never be selected by clicking a mark; a
	 * click on an unselected chart now falls through and selects it like any
	 * other element, exactly as clicking a bar in React does.
	 */
	const interactiveArmed = $derived(editable && selected);
	const drag = new ChartDragController({
		element: () => element as ChartPptxElement,
		root: () => rootEl,
		commit: (id, chartData) => onchartpointcommit?.(id, chartData),
	});
	$effect(() => () => drag.destroy());

	/**
	 * The chart element with its data trimmed to the stages revealed at the current
	 * build progress (`p:bldChart`). Whole-chart / no-build renders return the
	 * element unchanged. Mirrors Vue's / React's `revealedElement`.
	 */
	const revealedElement = $derived.by(() => {
		// `drag.rendered()` is the committed element until a value drag is in
		// flight, when it carries the live preview instead.
		const source = drag.rendered();
		if (source.type !== 'chart' || !source.chartData) {
			return source;
		}
		const revealed = resolveRevealedChartData(source.chartData, animationState);
		return revealed === source.chartData ? source : { ...source, chartData: revealed };
	});

	// An untargeted bar3D extrusion face whose fill is picture-only samples a
	// colour from the picture ASYNCHRONOUSLY (see `chart-bar3d-face-picture-
	// sample.ts`'s module doc for the COM-verified ground truth this
	// reproduces); `buildChartView` only ever sees whatever is already
	// cached, so `view` below reads this to rebuild once one lands.
	const barFacePictureSampleVersion = new BarFacePictureSampleVersion();
	$effect(() => () => barFacePictureSampleVersion.destroy());

	const view = $derived.by(() => {
		void barFacePictureSampleVersion.value;
		return revealedElement.type === 'chart' ? buildChartView(revealedElement, t) : undefined;
	});
	const legendItems = $derived(view?.kind === 'chart' ? buildLegendItems(view.vm) : []);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));

	// The projector re-creates every SVG mark whenever the chart changes, which
	// drops DOM-only classes, so the selected-mark highlight is re-applied after
	// each render rather than emitted as part of the markup.
	$effect(() => {
		void view;
		void drag.selectedPart;
		drag.syncHighlight();
	});

	// Focus (and select) the inline title editor when it opens: the dblclick
	// that opened it landed on the SVG title, so the browser gives the input
	// no focus of its own.
	$effect(() => {
		if (drag.titleDraft !== null) {
			titleInputEl?.focus();
			titleInputEl?.select();
		}
	});
</script>

{#if view}
	<!-- svelte-ignore a11y_no_static_element_interactions -- the chart marks are the
	     interactive surface; keyboard editing of a data point goes through the
	     chart inspector, as it does in the other four bindings. -->
	<div
		bind:this={rootEl}
		class={`pptx-svelte-element pptx-svelte-chart${interactiveArmed ? ' pptx-chart-interactive' : ''}`}
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive || marked ? 'true' : undefined}
		onpointerdown={interactiveArmed ? drag.onpointerdown : undefined}
		ondblclick={interactiveArmed ? drag.ondblclick : undefined}
	>
		{#if view.kind === 'chart'}
			<ChartSvgView vm={view.vm} preserveAspectRatio={view.preserveAspectRatio} {legendItems} />
		{:else}
			<div class="pptx-svelte-placeholder pptx-svelte-chart-placeholder">{view.label}</div>
		{/if}
		{#if drag.label !== null}
			<div class="pptx-svelte-chart-drag-badge">{drag.label}</div>
		{/if}
		{#if drag.titleDraft !== null}
			<input
				bind:this={titleInputEl}
				type="text"
				class="pptx-svelte-chart-title-input"
				value={drag.titleDraft}
				oninput={(event) => drag.setTitleDraft((event.currentTarget as HTMLInputElement).value)}
				onpointerdown={(event) => event.stopPropagation()}
				ondblclick={(event) => event.stopPropagation()}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						drag.commitTitle();
					} else if (event.key === 'Escape') {
						drag.cancelTitle();
					}
					event.stopPropagation();
				}}
				onblur={() => drag.commitTitle()}
			/>
		{/if}
	</div>
{/if}

<style>
	.pptx-svelte-chart-drag-badge {
		position: absolute;
		top: 4px;
		right: 4px;
		padding: 1px 6px;
		border-radius: 4px;
		background: #1e293b;
		color: #f8fafc;
		font-size: 10px;
		line-height: 1.5;
		pointer-events: none;
	}

	.pptx-svelte-chart-title-input {
		position: absolute;
		left: 50%;
		top: 2px;
		transform: translateX(-50%);
		z-index: 10;
		width: 60%;
		box-sizing: border-box;
		pointer-events: auto;
		text-align: center;
		font-size: 11px;
		padding: 2px 4px;
		border: 1px solid #cbd5e1;
		border-radius: 4px;
		background: #ffffff;
		color: #0f172a;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
	}

	.pptx-svelte-chart-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-size: 11px;
		color: #475569;
		background: #f1f5f9;
		border: 1px dashed #cbd5e1;
		box-sizing: border-box;
	}
</style>
