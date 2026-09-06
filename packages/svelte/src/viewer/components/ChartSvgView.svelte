<script lang="ts">
	/**
	 * The `<svg>` projection for a resolved chart view model: split out of
	 * `ChartView.svelte` purely to keep that SFC under the file-size limit.
	 * Pure presentational markup, no state of its own; all maths already
	 * happened in `buildChartView` / `buildChartViewModel`.
	 */
	import type { ChartViewModel } from 'pptx-viewer-shared';

	import type { ChartLegendItem } from '../render';
	import { partAttrs } from '../render';

	const {
		vm,
		preserveAspectRatio,
		legendItems,
	}: {
		vm: ChartViewModel;
		preserveAspectRatio: 'none' | 'xMidYMid meet';
		legendItems: ChartLegendItem[];
	} = $props();
</script>

<svg class="pptx-svelte-chart-svg" viewBox={`0 0 ${vm.svgWidth} ${vm.svgHeight}`} {preserveAspectRatio}>
	<!-- c:dPt/c:pictureOptions picture-fill patterns, rendered before anything
	     references them via fill="url(#...)" -->
	{#if vm.defs && vm.defs.length > 0}
		<defs>
			{#each vm.defs as def (def.id)}
				<pattern id={def.id} patternUnits={def.patternUnits} x={def.x} y={def.y} width={def.width} height={def.height}>
					<image href={def.href} x="0" y="0" width={def.width} height={def.height} preserveAspectRatio={def.preserveAspectRatio} />
				</pattern>
			{/each}
		</defs>
	{/if}

	<!-- Absent when the deck declares `<a:noFill/>` on `c:chartSpace`. -->
	{#if vm.areaFill}
		<rect x="0" y="0" width={vm.svgWidth} height={vm.svgHeight} rx={vm.areaRadius} fill={vm.areaFill} />
	{/if}

	{#if vm.title}
		<text
			x={vm.titleX}
			y={vm.titleY}
			text-anchor="middle"
			font-size={vm.titleStyle?.fontSize ?? 12}
			font-weight={vm.titleStyle?.fontWeight ?? 600}
			font-family={vm.titleStyle?.fontFamily}
			fill={vm.titleStyle?.fill ?? '#1e293b'}
			data-chart-part="title"
		>{#if vm.titleRunSpans && vm.titleRunSpans.length > 0}{#each vm.titleRunSpans as run, i (`title-run-${i}`)}<tspan font-size={run.fontSize} font-weight={run.fontWeight} font-style={run.fontStyle} font-family={run.fontFamily} fill={run.fill}>{run.text}</tspan>{/each}{:else}{vm.title}{/if}</text>
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
			<rect x={prim.x} y={prim.y} width={prim.w} height={prim.h} fill={prim.fill} rx={prim.rx ?? 0} opacity={prim.opacity ?? 1} {...partAttrs(prim.part)}>{#if prim.title !== undefined}<title>{prim.title}</title>{/if}</rect>
		{:else if prim.kind === 'path'}
			<!-- The shared descriptor's `title` is the shape's ACCESSIBLE NAME as
			     well as its hover text. A choropleth patch carries no label of its
			     own, so a region map without it announces nothing at all. -->
			<path d={prim.d} fill={prim.fill} stroke={prim.stroke ?? 'none'} stroke-width={prim.strokeWidth ?? 0} fill-opacity={prim.opacity ?? 1} {...partAttrs(prim.part)}>{#if prim.title !== undefined}<title>{prim.title}</title>{/if}</path>
		{:else if prim.kind === 'polyline'}
			<polyline points={prim.points} stroke={prim.stroke} stroke-width={prim.strokeWidth} fill={prim.fill} opacity={prim.opacity ?? 1} {...partAttrs(prim.part)}>{#if prim.title !== undefined}<title>{prim.title}</title>{/if}</polyline>
		{:else if prim.kind === 'circle'}
			<circle cx={prim.cx} cy={prim.cy} r={prim.r} fill={prim.fill} opacity={prim.opacity ?? 1} {...partAttrs(prim.part)}>{#if prim.title !== undefined}<title>{prim.title}</title>{/if}</circle>
		{:else if prim.kind === 'line'}
			<line x1={prim.x1} y1={prim.y1} x2={prim.x2} y2={prim.y2} stroke={prim.stroke} stroke-width={prim.strokeWidth} stroke-dasharray={prim.dashArray} opacity={prim.opacity ?? 1} transform={prim.transform}>{#if prim.title !== undefined}<title>{prim.title}</title>{/if}</line>
		{:else if prim.kind === 'polygon'}
			<polygon points={prim.points} fill={prim.fill} stroke={prim.stroke} stroke-width={prim.strokeWidth} opacity={prim.opacity ?? 1} stroke-dasharray={prim.dashArray} transform={prim.transform} {...partAttrs(prim.part)}>{#if prim.title !== undefined}<title>{prim.title}</title>{/if}</polygon>
		{:else if prim.kind === 'text'}
			<text x={prim.x} y={prim.y} text-anchor={prim.textAnchor} font-size={prim.fontSize} fill={prim.fill} font-weight={prim.fontWeight ?? 'normal'} font-style={prim.fontStyle ?? 'normal'} font-family={prim.fontFamily} dominant-baseline={prim.dominantBaseline} opacity={prim.opacity ?? 1} transform={prim.transform}>{prim.text}</text>
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
			<text x="13" y="3" font-size={entry.fontSize} fill={entry.fill} font-weight={entry.fontWeight} font-style={entry.fontStyle} font-family={entry.fontFamily}>{entry.label}</text>
		</g>
	{/each}
</svg>

<style>
	.pptx-svelte-chart-svg {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
