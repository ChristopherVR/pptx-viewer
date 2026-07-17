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
	import { computeInlineEditorRect, findSmartArtNodeText, resolvePalette } from 'pptx-viewer-shared';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, zIndex, interactive, onsmartartnodecommit, onsmartartnodefill }: ElementRendererProps = $props();
	const t = useTranslator();

	const smartArt = $derived(element.type === 'smartArt' ? element : undefined);
	const view = $derived(smartArt ? buildSmartArtView(smartArt) : undefined);
	const chromeStyle = $derived(smartArt ? smartArtChromeStyle(smartArt) : '');
	const ariaLabel = $derived(smartArt ? smartArtAriaLabel(smartArt) : undefined);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	const palette = $derived(smartArt?.smartArtData ? resolvePalette(smartArt.smartArtData) : []);
	// eslint-disable-next-line prefer-const
	let chromeEl = $state<HTMLDivElement>();
	let editing = $state<{ nodeId: string; left: number; top: number; width: number; height: number } | null>(null);
	let draft = $state('');
	let hovered = $state<{ nodeId: string; left: number; top: number } | null>(null);

	function nodeRect(target: SVGGElement) {
		if (!chromeEl) {return null;}
		const text = target.querySelector('text');
		const source = text && text.getBoundingClientRect().width > 0 ? text : target;
		return computeInlineEditorRect(source.getBoundingClientRect(), chromeEl.getBoundingClientRect());
	}

	function openEditor(event: MouseEvent, nodeId: string | undefined): void {
		if (!nodeId || !smartArt?.smartArtData || !onsmartartnodecommit) {return;}
		const rect = nodeRect(event.currentTarget as SVGGElement);
		if (!rect) {return;}
		event.stopPropagation();
		hovered = null;
		draft = findSmartArtNodeText(smartArt.smartArtData, nodeId) ?? '';
		editing = {
			nodeId,
			left: rect.left - 4,
			top: rect.top - 4,
			width: Math.max(48, rect.width + 8),
			height: Math.max(30, rect.height + 8),
		};
	}

	function showStyle(event: MouseEvent, nodeId: string | undefined): void {
		if (!nodeId || !onsmartartnodefill || editing) {return;}
		const rect = nodeRect(event.currentTarget as SVGGElement);
		if (rect) {hovered = { nodeId, left: Math.max(0, rect.left), top: Math.max(0, rect.top - 26) };}
	}

	function commitEdit(): void {
		if (!editing || !smartArt) {return;}
		onsmartartnodecommit?.(smartArt.id, editing.nodeId, draft);
		editing = null;
	}

	function editorKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			editing = null;
		} else if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			commitEdit();
		}
	}
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
	<div
		class="pptx-svelte-element pptx-svelte-smartart"
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive ? 'true' : undefined}
		data-testid={`smartart-${smartArt?.smartArtData?.layout ?? 'diagram'}`}
		aria-roledescription="diagram"
	>
		<div
			bind:this={chromeEl}
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
						<g
							style={`${view.shadow ? `filter: ${view.shadow};` : ''}${shape.nodeId && onsmartartnodecommit ? 'pointer-events: auto; cursor: text;' : ''}`}
							data-smartart-node-id={shape.nodeId}
							role={shape.ariaLabel ? 'img' : undefined}
							aria-label={shape.ariaLabel}
							ondblclick={(event) => openEditor(event, shape.nodeId)}
							onmouseenter={(event) => showStyle(event, shape.nodeId)}
						>
							{#if shape.ariaLabel}<title>{shape.ariaLabel}</title>{/if}
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
						<g
							style={`${view.layout.shadowFilter ? `filter: ${view.layout.shadowFilter};` : ''}${node.nodeId && onsmartartnodecommit ? 'pointer-events: auto; cursor: text;' : ''}`}
							data-smartart-node-id={node.nodeId}
							role={node.ariaLabel ? 'img' : undefined}
							aria-label={node.ariaLabel}
							ondblclick={(event) => openEditor(event, node.nodeId)}
							onmouseenter={(event) => showStyle(event, node.nodeId)}
						>
							{#if node.ariaLabel}<title>{node.ariaLabel}</title>{/if}
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
			{#if hovered && !editing}
				<div class="pptx-svelte-smartart-swatches" role="group" aria-label={t('pptx.smartArt.fillColor')} style={`left:${hovered.left}px;top:${hovered.top}px`} onmouseleave={() => (hovered = null)}>
					{#each palette.slice(0, 6) as color (color)}
						<button type="button" aria-label={`${t('pptx.smartArt.fillColor')} ${color}`} style={`background:${color}`} data-pptx-compact onclick={() => { if (smartArt) onsmartartnodefill?.(smartArt.id, hovered!.nodeId, color); hovered = null; }}></button>
					{/each}
				</div>
			{/if}
			{#if editing}
				<textarea
					class="pptx-svelte-smartart-editor"
					style={`left:${editing.left}px;top:${editing.top}px;width:${editing.width}px;height:${editing.height}px`}
					bind:value={draft}
					onkeydown={editorKeydown}
					onblur={commitEdit}
					onclick={(event) => event.stopPropagation()}
				></textarea>
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

	.pptx-svelte-smartart-swatches {
		position: absolute;
		z-index: 12;
		display: flex;
		gap: 4px;
		padding: 4px;
		border: 1px solid rgba(148, 163, 184, 0.7);
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.96);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-smartart-swatches button {
		width: 18px;
		height: 18px;
		padding: 0;
		border: 1px solid rgba(255, 255, 255, 0.8);
		border-radius: 4px;
		cursor: pointer;
	}

	.pptx-svelte-smartart-editor {
		position: absolute;
		z-index: 11;
		box-sizing: border-box;
		padding: 4px;
		resize: none;
		border: 2px solid #60a5fa;
		border-radius: 4px;
		outline: none;
		background: rgba(255, 255, 255, 0.96);
		color: #111827;
		font: inherit;
		text-align: center;
	}
</style>
