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
	import { applyChartBuildReveal } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { buildChartView, buildLegendItems, partAttrs } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import { ChartDragController } from './chart-drag.svelte';
	import type { ElementRendererProps } from './props';

	const { element, zIndex, animationState, interactive = false, marked = false, onchartpointcommit }: ElementRendererProps = $props();
	const t = useTranslator();

	/**
	 * Direct on-canvas editing is live only on the editable canvas: the stage
	 * passes `onchartpointcommit` there and nowhere else, so thumbnails and the
	 * presentation surface keep inert charts.
	 */
	let rootEl = $state<HTMLElement | null>(null);
	const editable = $derived(interactive && Boolean(onchartpointcommit) && element.type === 'chart');
	const drag = new ChartDragController({
		element: () => element as ChartPptxElement,
		root: () => rootEl,
		commit: (id, chartData) => onchartpointcommit?.(id, chartData),
	});
	$effect(() => () => drag.destroy());

	/** Staged chart-build descriptor, when an active native animation reveals one. */
	const chartBuild = $derived(
		animationState?.build?.kind === 'chart' ? animationState.build : undefined,
	);

	/**
	 * The chart element with its data trimmed to the stages revealed at the current
	 * build progress (`p:bldChart`). Whole-chart / no-build renders return the
	 * element unchanged. Mirrors Vue's / React's `revealedElement`.
	 */
	const revealedElement = $derived.by(() => {
		// `drag.rendered()` is the committed element until a value drag is in
		// flight, when it carries the live preview instead.
		const source = drag.rendered();
		if (source.type !== 'chart' || !chartBuild || !source.chartData) {
			return source;
		}
		const revealed = applyChartBuildReveal(source.chartData, chartBuild);
		return revealed === source.chartData ? source : { ...source, chartData: revealed };
	});

	const view = $derived(
		revealedElement.type === 'chart' ? buildChartView(revealedElement, t) : undefined,
	);
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
</script>

{#if view}
	<!-- svelte-ignore a11y_no_static_element_interactions -- the chart marks are the
	     interactive surface; keyboard editing of a data point goes through the
	     chart inspector, as it does in the other four bindings. -->
	<div
		bind:this={rootEl}
		class={`pptx-svelte-element pptx-svelte-chart${editable ? ' pptx-chart-interactive' : ''}`}
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive || marked ? 'true' : undefined}
		onpointerdown={editable ? drag.onpointerdown : undefined}
	>
		{#if view.kind === 'chart'}
			{@const vm = view.vm}
			<svg
				class="pptx-svelte-chart-svg"
				viewBox={`0 0 ${vm.svgWidth} ${vm.svgHeight}`}
				preserveAspectRatio={view.preserveAspectRatio}
			>
				<!-- Absent when the deck declares `<a:noFill/>` on `c:chartSpace`. -->
				{#if vm.areaFill}
					<rect x="0" y="0" width={vm.svgWidth} height={vm.svgHeight} fill={vm.areaFill} />
				{/if}

				{#if vm.title}
					<text
						x={vm.titleX}
						y={vm.titleY}
						text-anchor="middle"
						font-size="12"
						font-weight="600"
						fill="#1e293b"
						data-chart-part="title"
					>{vm.title}</text>
				{/if}

				{#each vm.gridlines as gl, i (`gl${i}`)}
					<line x1={gl.x1} y1={gl.y1} x2={gl.x2} y2={gl.y2} stroke={gl.stroke} stroke-width={gl.strokeWidth} stroke-dasharray={gl.dashArray} opacity={gl.opacity ?? 1} />
				{/each}
				{#each vm.secondaryGridlines ?? [] as gl, i (`sgl${i}`)}
					<line x1={gl.x1} y1={gl.y1} x2={gl.x2} y2={gl.y2} stroke={gl.stroke} stroke-width={gl.strokeWidth} stroke-dasharray={gl.dashArray} opacity={gl.opacity ?? 1} />
				{/each}

				{#each vm.axisLabels as lbl, i (`al${i}`)}
					<text x={lbl.x} y={lbl.y} text-anchor={lbl.textAnchor} font-size={lbl.fontSize} fill={lbl.fill} font-weight={lbl.fontWeight ?? 'normal'} dominant-baseline={lbl.dominantBaseline} opacity={lbl.opacity ?? 1} transform={lbl.transform}>{lbl.text}</text>
				{/each}
				{#each vm.secondaryAxisLabels ?? [] as lbl, i (`sal${i}`)}
					<text x={lbl.x} y={lbl.y} text-anchor={lbl.textAnchor} font-size={lbl.fontSize} fill={lbl.fill} font-weight={lbl.fontWeight ?? 'normal'} dominant-baseline={lbl.dominantBaseline} opacity={lbl.opacity ?? 1} transform={lbl.transform}>{lbl.text}</text>
				{/each}

				{#if vm.zeroLine}
					<line x1={vm.zeroLine.x1} y1={vm.zeroLine.y1} x2={vm.zeroLine.x2} y2={vm.zeroLine.y2} stroke={vm.zeroLine.stroke} stroke-width={vm.zeroLine.strokeWidth} stroke-dasharray={vm.zeroLine.dashArray} opacity={vm.zeroLine.opacity ?? 1} />
				{/if}

				{#each vm.categoryLabels as lbl, i (`cl${i}`)}
					<text x={lbl.x} y={lbl.y} text-anchor={lbl.textAnchor} font-size={lbl.fontSize} fill={lbl.fill} font-weight={lbl.fontWeight ?? 'normal'} dominant-baseline={lbl.dominantBaseline}>{lbl.text}</text>
				{/each}

				{#each vm.primitives as prim, i (`p${i}`)}
					{#if prim.kind === 'rect'}
						<rect x={prim.x} y={prim.y} width={prim.w} height={prim.h} fill={prim.fill} rx={prim.rx ?? 0} opacity={prim.opacity ?? 1} {...partAttrs(prim.part)} />
					{:else if prim.kind === 'path'}
						<!-- The shared descriptor's `title` is the shape's ACCESSIBLE NAME as
						     well as its hover text. A choropleth patch carries no label of its
						     own, so a region map without it announces nothing at all. -->
						<path d={prim.d} fill={prim.fill} stroke={prim.stroke ?? 'none'} stroke-width={prim.strokeWidth ?? 0} fill-opacity={prim.opacity ?? 1} {...partAttrs(prim.part)}>{#if prim.title !== undefined}<title>{prim.title}</title>{/if}</path>
					{:else if prim.kind === 'polyline'}
						<polyline points={prim.points} stroke={prim.stroke} stroke-width={prim.strokeWidth} fill={prim.fill} opacity={prim.opacity ?? 1} {...partAttrs(prim.part)} />
					{:else if prim.kind === 'circle'}
						<circle cx={prim.cx} cy={prim.cy} r={prim.r} fill={prim.fill} opacity={prim.opacity ?? 1} {...partAttrs(prim.part)} />
					{:else if prim.kind === 'line'}
						<line x1={prim.x1} y1={prim.y1} x2={prim.x2} y2={prim.y2} stroke={prim.stroke} stroke-width={prim.strokeWidth} stroke-dasharray={prim.dashArray} opacity={prim.opacity ?? 1} />
					{:else if prim.kind === 'polygon'}
						<polygon points={prim.points} fill={prim.fill} stroke={prim.stroke} stroke-width={prim.strokeWidth} opacity={prim.opacity ?? 1} stroke-dasharray={prim.dashArray} {...partAttrs(prim.part)} />
					{:else if prim.kind === 'text'}
						<text x={prim.x} y={prim.y} text-anchor={prim.textAnchor} font-size={prim.fontSize} fill={prim.fill} font-weight={prim.fontWeight ?? 'normal'} dominant-baseline={prim.dominantBaseline} opacity={prim.opacity ?? 1} transform={prim.transform}>{prim.text}</text>
					{/if}
					<!-- 'areaGradient' is a non-visual descriptor (gradient defs); skipped
					     by the Vue/React/vanilla projectors as well. -->
				{/each}

				{#each vm.dataLabels as dl, i (`dl${i}`)}
					<text x={dl.x} y={dl.y} text-anchor={dl.textAnchor} font-size={dl.fontSize} fill={dl.fill} font-weight={dl.fontWeight ?? 'normal'} dominant-baseline={dl.dominantBaseline}>{dl.text}</text>
				{/each}

				{#each legendItems as entry (entry.key)}
					<g class="pptx-svelte-chart-legend-item" transform={entry.transform}>
						<rect x="0" y="-7" width="10" height="10" rx="2" fill={entry.color} />
						<text x="13" y="3" font-size="9" fill="#475569">{entry.label}</text>
					</g>
				{/each}
			</svg>
		{:else}
			<div class="pptx-svelte-placeholder pptx-svelte-chart-placeholder">{view.label}</div>
		{/if}
		{#if drag.label !== null}
			<div class="pptx-svelte-chart-drag-badge">{drag.label}</div>
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

	.pptx-svelte-chart-svg {
		width: 100%;
		height: 100%;
		display: block;
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
