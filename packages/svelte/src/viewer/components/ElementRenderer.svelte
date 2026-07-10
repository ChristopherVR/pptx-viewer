<script lang="ts">
	/**
	 * ElementRenderer: a thin dispatcher over the `PptxElement` discriminated
	 * union (Svelte port of Vue's `ElementRenderer`). Real renderers: group
	 * (recursive), image/picture, connector, and text/shape. Every other type
	 * (table, chart, smartArt, media, ink, ole, ...) currently renders a typed
	 * placeholder; add a component + branch here to port one for real.
	 */
	import { buildParagraphs } from 'pptx-viewer-shared';

	import { getContainerStyle, getShapeBoxStyle, getTextBlockStyle, styleToString } from '../style';
	// Self-import: groups recurse into this same component (Svelte 5 pattern).
	// eslint-disable-next-line import/no-self-import
	import ElementRenderer from './ElementRenderer.svelte';
	import ConnectorView from './ConnectorView.svelte';
	import ImageBox from './ImageBox.svelte';
	import PlaceholderElement from './PlaceholderElement.svelte';
	import TextBlock from './TextBlock.svelte';
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
