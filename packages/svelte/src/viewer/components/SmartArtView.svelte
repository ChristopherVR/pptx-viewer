<script lang="ts">
	/**
	 * SmartArtView: viewer renderer for `smartArt` elements (Svelte port of
	 * the vanilla / Vue SmartArt renderer):
	 *
	 * - Drawing-shapes path (preferred): pre-computed `drawingShapes` extracted
	 *   by core from `ppt/diagrams/drawing*.xml`, projected by the shared
	 *   `projectDrawingShapes` (palette / stroke / shadow resolution included).
	 * - Fallback layout path: the shared layout engine (`computeSmartArtLayout`)
	 *   over the node tree (rect / circle / polygon geometry + connectors).
	 * - Empty placeholder: no data or zero nodes renders a labelled box.
	 *
	 * The graphic is wrapped in chrome (background / outline) and described to
	 * assistive tech via the shared diagram label (`role="img"` + aria-label).
	 */
	import { useTranslator } from '../../i18n/context';
	import {
		buildSmartArtView,
		SMARTART_CONNECTOR_STROKE,
		SMARTART_SVG_STYLE,
		smartArtAriaLabel,
		smartArtChromeStyle,
		svgTextLines,
	} from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, zIndex }: ElementRendererProps = $props();
	const t = useTranslator();

	const smartArt = $derived(element.type === 'smartArt' ? element : undefined);
	const view = $derived(smartArt ? buildSmartArtView(smartArt) : undefined);
	const chromeStyle = $derived(smartArt ? smartArtChromeStyle(smartArt) : '');
	const ariaLabel = $derived(smartArt ? smartArtAriaLabel(smartArt) : undefined);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
</script>

{#snippet centeredText(text: string, x: number, y: number, fill: string, fontSize: number)}
	<!-- Centred, multi-line label: one <tspan> per line, block centred on y. -->
	<text {x} text-anchor="middle" dominant-baseline="central" {fill} font-size={fontSize}>
		{#each svgTextLines(text, fontSize) as line, i (i)}
			<tspan {x} y={y + line.y}>{line.text}</tspan>
		{/each}
	</text>
{/snippet}

{#if view}
	<div class="pptx-svelte-element pptx-svelte-smartart" style={containerStyle} data-element-id={element.id}>
		<div
			class="pptx-svelte-smartart-chrome"
			style={chromeStyle}
			role={ariaLabel !== undefined ? 'img' : undefined}
			aria-label={ariaLabel}
		>
			{#if view.kind === 'drawing'}
				<svg
					class="pptx-svelte-smartart-svg"
					viewBox={view.viewBox}
					preserveAspectRatio="xMidYMid meet"
					style={SMARTART_SVG_STYLE}
				>
					{#each view.shapes as shape (shape.key)}
						<g style={view.shadow ? `filter: ${view.shadow}` : undefined}>
							{#if shape.isEllipse}
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
							{#if shape.text}
								{@render centeredText(shape.text, shape.textX, shape.textY, shape.fontColor, shape.fontSize)}
							{/if}
						</g>
					{/each}
				</svg>
			{:else if view.kind === 'layout'}
				<svg
					class="pptx-svelte-smartart-svg"
					viewBox={view.layout.viewBox}
					preserveAspectRatio="xMidYMid meet"
					data-layout-family={view.layout.family}
					style={SMARTART_SVG_STYLE}
				>
					<!-- Connectors render first so they appear behind nodes. -->
					{#each view.layout.connectors as conn (conn.key)}
						<path d={conn.d} fill="none" stroke={SMARTART_CONNECTOR_STROKE} stroke-width="1.5" opacity="0.5" />
					{/each}
					{#each view.layout.nodes as node (node.key)}
						<g style={view.layout.shadowFilter ? `filter: ${view.layout.shadowFilter}` : undefined}>
							{#if node.kind === 'circle'}
								<circle cx={node.cx} cy={node.cy} r={node.r} fill={node.fill} stroke={node.stroke} stroke-width={node.strokeWidth} opacity={node.opacity} />
								{@render centeredText(node.text, node.cx, node.cy, 'white', node.fontSize)}
							{:else if node.kind === 'polygon'}
								<polygon points={node.points} fill={node.fill} stroke={node.stroke} stroke-width={node.strokeWidth} opacity={node.opacity} />
								{@render centeredText(node.text, node.textX, node.textY, 'white', node.fontSize)}
							{:else}
								<rect x={node.x} y={node.y} width={node.width} height={node.height} rx={node.rx} fill={node.fill} stroke={node.stroke} stroke-width={node.strokeWidth} opacity={node.opacity} />
								{@render centeredText(node.text, node.textX, node.textY, 'white', node.fontSize)}
							{/if}
						</g>
					{/each}
				</svg>
			{:else}
				<div class="pptx-svelte-smartart-placeholder">{t('pptx.smartArt.placeholder')}</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-smartart-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.8);
		pointer-events: none;
	}
</style>
