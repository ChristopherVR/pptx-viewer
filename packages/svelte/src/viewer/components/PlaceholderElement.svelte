<script lang="ts">
	/**
	 * PlaceholderElement: a clean, typed stand-in for element types whose real
	 * Svelte renderer has not been ported yet (table, chart, smartArt, media,
	 * ink, ole, ...). Occupies the element's exact bounds so slide layout stays
	 * faithful; renders the element type as a muted badge.
	 *
	 * To port a type for real: add a dedicated component and branch to it from
	 * `ElementRenderer` before the placeholder fallback.
	 */
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, zIndex }: ElementRendererProps = $props();

	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
</script>

<div
	class="pptx-svelte-element pptx-svelte-placeholder"
	style={containerStyle}
	data-element-id={element.id}
	data-element-type={element.type}
>
	<span class="pptx-svelte-placeholder-label">{element.type}</span>
</div>

<style>
	.pptx-svelte-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed rgba(100, 116, 139, 0.6);
		border-radius: 4px;
		background: rgba(148, 163, 184, 0.08);
		overflow: hidden;
	}

	.pptx-svelte-placeholder-label {
		font-size: 11px;
		font-family: system-ui, sans-serif;
		color: rgba(100, 116, 139, 0.9);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
</style>
