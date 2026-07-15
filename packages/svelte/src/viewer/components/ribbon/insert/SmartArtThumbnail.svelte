<script lang="ts">
	import type { SmartArtLayout, SmartArtPptxElement } from 'pptx-viewer-core';
	import { buildSmartArtPresetData } from 'pptx-viewer-shared';

	import SmartArtView from '../../SmartArtView.svelte';

	const { layout, defaultItems }: { layout: SmartArtLayout; defaultItems: string[] } = $props();
	const mediaDataUrls = new Map<string, string>();
	const element = $derived({
		id: `smartart-preview-${layout}`,
		type: 'smartArt',
		x: 0,
		y: 0,
		width: 600,
		height: 340,
		smartArtData: buildSmartArtPresetData(layout, defaultItems),
	} as SmartArtPptxElement);
</script>

<div class="pptx-svelte-smartart-thumbnail" aria-hidden="true">
	<div class="pptx-svelte-smartart-thumbnail-scale">
		<SmartArtView {element} {mediaDataUrls} zIndex={0} />
	</div>
</div>

<style>
	.pptx-svelte-smartart-thumbnail {
		position: relative;
		width: 72px;
		height: 42px;
		overflow: hidden;
		border-radius: 4px;
		background: var(--pptx-muted, #252538);
		pointer-events: none;
	}

	.pptx-svelte-smartart-thumbnail-scale {
		position: relative;
		width: 600px;
		height: 340px;
		transform: scale(0.12);
		transform-origin: top left;
	}
</style>
