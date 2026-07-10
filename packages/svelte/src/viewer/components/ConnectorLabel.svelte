<script lang="ts">
	/**
	 * ConnectorLabel: a connector's attached text, centred over its bounding
	 * box (port of the Vue `ConnectorTextOverlay`). A plain absolutely
	 * positioned flex container above the SVG; `pointer-events: none` so it
	 * never intercepts hit-testing.
	 */
	import type { PptxElementWithText } from 'pptx-viewer-core';

	import {
		connectorLabelBlockStyle,
		connectorLabelContainerStyle,
		connectorLabelSegmentStyle,
	} from '../style/connector-label';
	import { styleToString } from '../style';

	const { element }: { element: PptxElementWithText } = $props();

	const text = $derived(element.text?.trim() ?? '');
	const segments = $derived(element.textSegments ?? []);
</script>

{#if text && segments.length > 0}
	<div
		class="pptx-svelte-connector-text"
		style={styleToString(connectorLabelContainerStyle(element.textStyle))}
	>
		<div
			class="pptx-svelte-connector-text-block"
			style={styleToString(connectorLabelBlockStyle(element.textStyle))}
		>
			{#each segments as seg, idx (idx)}<span
					style={styleToString(connectorLabelSegmentStyle(seg, element.textStyle))}>{seg.text}</span
				>{/each}
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-connector-text {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		pointer-events: none;
	}

	.pptx-svelte-connector-text-block {
		padding: 0 4px;
		white-space: pre-wrap;
		line-height: 1.2;
		max-width: 100%;
	}
</style>
