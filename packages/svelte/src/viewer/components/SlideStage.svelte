<script lang="ts">
	/**
	 * SlideStage: the fixed-size slide surface (resolved background +
	 * absolutely-positioned elements) rendered at a given `scale` (Svelte port
	 * of Vue's `SlideStage`). Reused at full size by the main canvas and at
	 * tiny scale by the thumbnail rail; it owns no chrome, the host decides
	 * layout.
	 */
	import { getSlideBackgroundStyle } from 'pptx-viewer-shared';

	import { styleToString } from '../style';
	import ElementRenderer from './ElementRenderer.svelte';
	import type { SlideStageProps } from './props';

	const { slide, canvasSize, mediaDataUrls, scale = 1 }: SlideStageProps = $props();

	const stageStyle = $derived(
		styleToString({
			width: `${canvasSize.width}px`,
			height: `${canvasSize.height}px`,
			transform: `scale(${scale})`,
			transformOrigin: 'top left',
			position: 'relative',
			overflow: 'hidden',
			// Resolved slide background: image -> gradient -> pattern -> solid.
			...getSlideBackgroundStyle(slide),
		}),
	);
</script>

<div class="pptx-svelte-stage" style={stageStyle}>
	{#each slide?.elements ?? [] as element, index (element.id)}
		<ElementRenderer {element} {mediaDataUrls} zIndex={index} />
	{/each}
</div>
