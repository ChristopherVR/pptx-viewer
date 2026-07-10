<script lang="ts">
	/**
	 * SlideStage: the fixed-size slide surface (resolved background +
	 * absolutely-positioned elements) rendered at a given `scale` (Svelte port
	 * of Vue's `SlideStage`). Reused at full size by the main canvas and at
	 * tiny scale by the thumbnail rail; it owns no chrome, the host decides
	 * layout.
	 */
	import { getSlideBackgroundStyle } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { styleToString } from '../style';
	import ElementRenderer from './ElementRenderer.svelte';
	import type { SlideStageProps } from './props';

	const {
		slide,
		canvasSize,
		mediaDataUrls,
		scale = 1,
		presenting = false,
		interactive = false,
	}: SlideStageProps = $props();

	const t = useTranslator();

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

<div
	class="pptx-svelte-stage"
	style={stageStyle}
	role={interactive ? 'region' : undefined}
	aria-roledescription={interactive ? 'slide' : undefined}
	aria-label={interactive ? t('pptx.canvas.slide') : undefined}
>
	{#each slide?.elements ?? [] as element, index (element.id)}
		<ElementRenderer {element} {mediaDataUrls} zIndex={index} {presenting} {interactive} />
	{/each}
</div>
