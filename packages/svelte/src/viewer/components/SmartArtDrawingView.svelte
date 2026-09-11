<script lang="ts">
	import { SMARTART_SVG_STYLE } from '../render';
	import type { SmartArtDrawingViewProps } from './props';

	const { view, canEditNodeText, onopeneditor, onshowstyle }: SmartArtDrawingViewProps = $props();
</script>

<svg
	class="pptx-svelte-smartart-svg"
	viewBox={view.viewBox}
	preserveAspectRatio="xMidYMid meet"
	style={SMARTART_SVG_STYLE}
>
	{#each view.shapes as shape (shape.key)}
		<g
			style={`${view.shadow ? `filter: ${view.shadow};` : ''}${shape.nodeId && canEditNodeText ? 'pointer-events: auto; cursor: text;' : ''}`}
			data-smartart-node-id={shape.nodeId}
			role={shape.ariaLabel ? 'img' : undefined}
			aria-label={shape.ariaLabel}
			ondblclick={(event) => onopeneditor(event, shape.nodeId)}
			onmouseenter={(event) => onshowstyle(event, shape.nodeId)}
		>
			{#if shape.ariaLabel}<title>{shape.ariaLabel}</title>{/if}
			{#if shape.gradient}
				<defs>
					{#if shape.gradient.kind === 'radial'}
						<radialGradient
							id={shape.gradient.id}
							cx={shape.gradient.cx}
							cy={shape.gradient.cy}
							r={shape.gradient.r}
						>
							{#each shape.gradient.stops as stop, si (si)}
								<stop
									offset={stop.offset}
									stop-color={stop.color}
									stop-opacity={stop.opacity}
								/>
							{/each}
						</radialGradient>
					{:else}
						<linearGradient
							id={shape.gradient.id}
							x1={shape.gradient.x1}
							y1={shape.gradient.y1}
							x2={shape.gradient.x2}
							y2={shape.gradient.y2}
						>
							{#each shape.gradient.stops as stop, si (si)}
								<stop
									offset={stop.offset}
									stop-color={stop.color}
									stop-opacity={stop.opacity}
								/>
							{/each}
						</linearGradient>
					{/if}
				</defs>
			{/if}
			{#if shape.kind === 'image'}
				<image
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					href={shape.imageUrl}
					preserveAspectRatio="xMidYMid meet"
					transform={shape.transform}
				/>
			{:else if shape.kind === 'ellipse'}
				<ellipse
					cx={shape.cx}
					cy={shape.cy}
					rx={shape.width / 2}
					ry={shape.height / 2}
					fill={shape.fill}
					stroke={shape.stroke}
					stroke-width={shape.strokeWidth}
					transform={shape.transform}
				/>
			{:else if shape.kind === 'path'}
				<path
					d={shape.pathData}
					fill={shape.fill}
					stroke={shape.stroke}
					stroke-width={shape.strokeWidth}
					transform={shape.pathTransform}
				/>
			{:else}
				<rect
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					rx={shape.rx}
					fill={shape.fill}
					stroke={shape.stroke}
					stroke-width={shape.strokeWidth}
					transform={shape.transform}
				/>
			{/if}
			{#if shape.textLines.length > 0}
				<text
					x={shape.textX}
					text-anchor="middle"
					dominant-baseline="central"
					fill={shape.fontColor}
					font-family={shape.fontFamily}
					font-weight={shape.fontWeight}
					font-style={shape.fontStyle}
					font-size={shape.fontSize}
				>
					{#each shape.textLines as line, i (i)}
						<tspan x={shape.textX} y={line.y}>{line.text}</tspan>
					{/each}
				</text>
			{/if}
		</g>
	{/each}
</svg>
