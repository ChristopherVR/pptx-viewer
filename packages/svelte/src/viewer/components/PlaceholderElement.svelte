<script lang="ts">
	/**
	 * PlaceholderElement: a clean, typed stand-in for element types whose real
	 * Svelte renderer has not been ported yet (currently only `unknown`).
	 * Occupies the element's exact bounds so slide layout stays faithful;
	 * renders the element type as a muted badge.
	 *
	 * To port a type for real: add a dedicated component and branch to it from
	 * `ElementRenderer` before the placeholder fallback.
	 */
	import { shouldRenderHitTarget } from 'pptx-viewer-shared';

	import { getContainerStyle, getElementHitTargetStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const {
		element,
		zIndex,
		interactive = false,
		marked = false,
		editable = false,
		presenting = false,
	}: ElementRendererProps = $props();

	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	/**
	 * Interaction-only hit target for a degenerate (sub-MIN_ELEMENT_SIZE)
	 * unmatched-type placeholder; see `ElementRenderer`'s identical `hitTarget`
	 * doc (issue #285).
	 */
	const hitTarget = $derived(
		shouldRenderHitTarget(editable, presenting) ? getElementHitTargetStyle(element) : undefined,
	);
</script>

<div
	class="pptx-svelte-element pptx-svelte-placeholder"
	style={containerStyle}
	data-element-id={element.id}
	data-element-type={element.type}
	data-pptx-element={interactive || marked ? 'true' : undefined}
>
	<!-- Interaction-only hit target for a degenerate placeholder; see `hitTarget`. -->
	{#if hitTarget}
		<div aria-hidden="true" data-pptx-hit-target="true" style={styleToString(hitTarget)}></div>
	{/if}
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
