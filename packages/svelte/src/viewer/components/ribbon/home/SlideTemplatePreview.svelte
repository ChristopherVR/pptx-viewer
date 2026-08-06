<script lang="ts">
	/**
	 * SlideTemplatePreview: live-rendered miniature of a slide template.
	 *
	 * Mirrors React's `SlideTemplatePreview` (and the SmartArt gallery
	 * pattern): build the exact elements insertion would produce (shared
	 * `buildSlideTemplateContent`) at full canvas size, render them through
	 * the real `SlideStage` / `ElementRenderer` pipeline, and scale the stage
	 * down so the preview is pixel-faithful to what Insert lands in the deck.
	 */
	import type { PptxSlide } from 'pptx-viewer-core';
	import { buildSlideTemplateContent } from 'pptx-viewer-shared';
	import type { SlideTemplateId } from 'pptx-viewer-shared';

	import SlideStage from '../../SlideStage.svelte';

	const {
		templateId,
		scheme,
	}: {
		templateId: SlideTemplateId;
		/** Optional deck scheme so the preview shows the deck's theme colours. */
		scheme?: Record<string, string>;
	} = $props();

	/** Full-size stage the template is built at (standard 16:9 canvas). */
	const PREVIEW_CANVAS = { width: 1280, height: 720 };
	/** 144px tile width over the 1280px stage = scale 0.1125 (tile 144 x 81). */
	const PREVIEW_SCALE = 144 / PREVIEW_CANVAS.width;

	const mediaDataUrls = new Map<string, string>();
	const previewSlide = $derived.by((): PptxSlide => {
		const content = buildSlideTemplateContent(templateId, {
			slideWidth: PREVIEW_CANVAS.width,
			slideHeight: PREVIEW_CANVAS.height,
			...(scheme ? { scheme } : {}),
			idFor: (index) => `tpl-preview-${templateId}-${index}`,
		});
		return {
			id: `tpl-preview-${templateId}`,
			rId: '',
			slideNumber: 1,
			elements: content.elements,
			...(content.backgroundColor ? { backgroundColor: content.backgroundColor } : {}),
		};
	});
</script>

<div class="pptx-svelte-slide-template-preview" aria-hidden="true">
	<SlideStage
		slide={previewSlide}
		canvasSize={PREVIEW_CANVAS}
		{mediaDataUrls}
		scale={PREVIEW_SCALE}
	/>
</div>

<style>
	.pptx-svelte-slide-template-preview {
		width: 144px;
		height: 81px;
		overflow: hidden;
		border-radius: 4px;
		background: #fff;
		pointer-events: none;
	}
</style>
