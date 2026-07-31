<script lang="ts">
	/**
	 * ConnectorView: renders straight, bent, and curved connectors as an inline
	 * SVG spanning the element's bounding box, with stroke colour/width/dash,
	 * start/end arrowheads, compound (double/triple) line support, and line
	 * shadow/glow effects. All geometry comes from the shared, framework
	 * agnostic `buildConnectorGeometry`; this component only emits SVG.
	 */
	import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
	import { buildConnectorGeometry, getLineGlowFilterCss, getLineShadowParams } from 'pptx-viewer-shared';

	import { styleToString } from '../style';
	import type { ElementRendererProps } from './props';
	import ConnectorLabel from './ConnectorLabel.svelte';

	const { element, zIndex, animationState, interactive = false }: ElementRendererProps = $props();

	const geometry = $derived(buildConnectorGeometry(element, zIndex));
	/**
	 * Effective stroke paint. When an active `p:animClr` colour animation targets
	 * this connector's stroke, paint `inherit` so the wrapper's animated `color` /
	 * `stroke` keyframes cascade into the line + arrowheads (mirrors Vue's
	 * `ConnectorRenderer`). Otherwise the resolved geometry stroke wins.
	 */
	const strokeColor = $derived(
		animationState?.animatesStroke ? 'inherit' : geometry.strokeColor,
	);
	const shapeStyle = $derived(hasShapeProperties(element) ? element.shapeStyle : undefined);
	const lineShadow = $derived(getLineShadowParams(shapeStyle));
	const lineGlow = $derived(getLineGlowFilterCss(shapeStyle));
	const shadowFilterId = $derived(`${geometry.startMarkerId.replace(/-start$/u, '')}-line-shadow`);
	const wrapperStyle = $derived(
		lineGlow ? `${geometry.wrapperStyle};filter:${lineGlow}` : geometry.wrapperStyle,
	);

	/** The element narrowed to its text properties, when it carries a label. */
	const textElement = $derived(hasTextProperties(element) ? element : undefined);
</script>

<div class="pptx-svelte-element pptx-svelte-connector" style={wrapperStyle} data-element-id={element.id} data-pptx-element={interactive ? 'true' : undefined}>
	<svg
		width={geometry.svgW}
		height={geometry.svgH}
		viewBox={`0 0 ${geometry.svgW} ${geometry.svgH}`}
		style="overflow: visible; display: block"
	>
		<defs>
			{#if geometry.startMarker}
				<marker
					id={geometry.startMarkerId}
					viewBox="0 0 10 10"
					refX="5"
					refY="5"
					markerWidth={geometry.startMarker.markerWidth}
					markerHeight={geometry.startMarker.markerHeight}
					orient="auto-start-reverse"
					markerUnits="strokeWidth"
				>
					{#if geometry.startMarker.shape === 'circle'}
						<circle cx="5" cy="5" r="4" fill={strokeColor} />
					{:else}
						<path d={geometry.startMarker.d} fill={strokeColor} />
					{/if}
				</marker>
			{/if}
			{#if geometry.endMarker}
				<marker
					id={geometry.endMarkerId}
					viewBox="0 0 10 10"
					refX="5"
					refY="5"
					markerWidth={geometry.endMarker.markerWidth}
					markerHeight={geometry.endMarker.markerHeight}
					orient="auto-start-reverse"
					markerUnits="strokeWidth"
				>
					{#if geometry.endMarker.shape === 'circle'}
						<circle cx="5" cy="5" r="4" fill={strokeColor} />
					{:else}
						<path d={geometry.endMarker.d} fill={strokeColor} />
					{/if}
				</marker>
			{/if}
			{#if lineShadow}
				<filter id={shadowFilterId} x="-50%" y="-50%" width="200%" height="200%">
					<feDropShadow
						dx={lineShadow.offsetX}
						dy={lineShadow.offsetY}
						stdDeviation={lineShadow.blur / 2}
						flood-color={lineShadow.color}
						flood-opacity={lineShadow.opacity}
					/>
				</filter>
			{/if}
		</defs>

		{#each geometry.compoundOffsets as offset, idx (idx)}
			{#if geometry.pathD}
				<path
					d={geometry.pathD}
					fill="none"
					stroke={strokeColor}
					stroke-width={Math.max(geometry.compoundWidths[idx] ?? geometry.strokeWidth, 1)}
					stroke-opacity={geometry.strokeOpacity}
					stroke-dasharray={geometry.dashArray}
					stroke-linecap={geometry.strokeLinecap}
					stroke-linejoin="round"
					filter={idx === 0 && lineShadow ? `url(#${shadowFilterId})` : undefined}
					style={offset !== 0 ? styleToString({ transform: `translate(0, ${offset}px)` }) : undefined}
					marker-start={idx === 0 ? (geometry.startMarkerRef ?? undefined) : undefined}
					marker-end={idx === geometry.compoundOffsets.length - 1
						? (geometry.endMarkerRef ?? undefined)
						: undefined}
				/>
			{:else}
				<line
					x1={geometry.x1}
					y1={geometry.y1 + offset}
					x2={geometry.x2}
					y2={geometry.y2 + offset}
					stroke={strokeColor}
					stroke-width={Math.max(geometry.compoundWidths[idx] ?? geometry.strokeWidth, 1)}
					stroke-opacity={geometry.strokeOpacity}
					stroke-dasharray={geometry.dashArray}
					stroke-linecap={geometry.strokeLinecap}
					filter={idx === 0 && lineShadow ? `url(#${shadowFilterId})` : undefined}
					marker-start={idx === 0 ? (geometry.startMarkerRef ?? undefined) : undefined}
					marker-end={idx === geometry.compoundOffsets.length - 1
						? (geometry.endMarkerRef ?? undefined)
						: undefined}
				/>
			{/if}
		{/each}
	</svg>

	{#if textElement?.textSegments?.length}
		<ConnectorLabel element={textElement} />
	{/if}
</div>
