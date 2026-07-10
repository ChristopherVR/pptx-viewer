<script lang="ts">
	/**
	 * ElementRenderer: a thin dispatcher over the `PptxElement` discriminated
	 * union (Svelte port of Vue's `ElementRenderer`). Real renderers: group
	 * (recursive), image/picture, connector, text/shape, table, chart,
	 * smartArt, media, ink, ole, contentPart, zoom, and model3d. Only
	 * `unknown` still falls through to the typed placeholder.
	 */
	import { buildParagraphs } from 'pptx-viewer-shared';

	import { getContainerStyle, getShapeBoxStyle, getTextBlockStyle, styleToString } from '../style';
	// Self-import: groups recurse into this same component (Svelte 5 pattern).
	// eslint-disable-next-line import/no-self-import
	import ElementRenderer from './ElementRenderer.svelte';
	import ChartView from './ChartView.svelte';
	import ConnectorView from './ConnectorView.svelte';
	import ContentPartView from './ContentPartView.svelte';
	import ImageBox from './ImageBox.svelte';
	import InkView from './InkView.svelte';
	import MediaBox from './MediaBox.svelte';
	import Model3dView from './Model3dView.svelte';
	import OleView from './OleView.svelte';
	import PlaceholderElement from './PlaceholderElement.svelte';
	import SmartArtView from './SmartArtView.svelte';
	import TableView from './TableView.svelte';
	import TextBlock from './TextBlock.svelte';
	import ZoomView from './ZoomView.svelte';
	import type { ElementRendererProps } from './props';

	const { element, mediaDataUrls, zIndex }: ElementRendererProps = $props();

	const isShapeLike = $derived(element.type === 'text' || element.type === 'shape');
	const isImageLike = $derived(element.type === 'picture' || element.type === 'image');

	/** Rendered paragraphs (runs + bullet/indent), built by shared logic. */
	const paragraphs = $derived(buildParagraphs(element));
	const hasText = $derived(
		paragraphs.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined),
	);
</script>

{#if element.type === 'group'}
	<!-- Group: recurse into children. -->
	<div
		class="pptx-svelte-element pptx-svelte-group"
		style={styleToString(getContainerStyle(element, zIndex))}
		data-element-id={element.id}
	>
		{#each element.children ?? [] as child, i (child.id)}
			<ElementRenderer element={child} {mediaDataUrls} zIndex={i} />
		{/each}
	</div>
{:else if isImageLike}
	<ImageBox {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'connector'}
	<ConnectorView {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'table'}
	<TableView {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'chart'}
	<ChartView {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'smartArt'}
	<SmartArtView {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'media'}
	<MediaBox {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'ink'}
	<InkView {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'ole'}
	<OleView {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'contentPart'}
	<ContentPartView {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'zoom'}
	<ZoomView {element} {mediaDataUrls} {zIndex} />
{:else if element.type === 'model3d'}
	<Model3dView {element} {mediaDataUrls} {zIndex} />
{:else if isShapeLike}
	<!-- Text / shape: shared fill/stroke/effects/geometry + rich text block. -->
	<div
		class="pptx-svelte-element pptx-svelte-shape"
		style={styleToString(getShapeBoxStyle(element, zIndex))}
		data-element-id={element.id}
	>
		{#if hasText}
			<TextBlock {paragraphs} textStyle={styleToString(getTextBlockStyle(element))} />
		{/if}
	</div>
{:else}
	<PlaceholderElement {element} {mediaDataUrls} {zIndex} />
{/if}
