<script lang="ts">
	/**
	 * LayoutArtwork: one layout's real artwork, drawn at slide size inside the
	 * shared layout gallery's scaled tile surface (the shared element owns the
	 * tile, scale and placeholder frames; this binding owns element rendering).
	 */
	import type { PptxLayoutPreview, PptxSlide } from 'pptx-viewer-core';
	import type { LayoutPreviewGeometry } from 'pptx-viewer-shared';

	import SlideStage from '../../SlideStage.svelte';

	/** Cap on artwork drawn per thumbnail; layouts never legitimately exceed this. */
	const MAX_PREVIEW_ELEMENTS = 100;
	/** No media in a layout thumbnail; images arrive already decoded. */
	const EMPTY_MEDIA = new Map<string, string>();

	const { preview, geometry }: { preview: PptxLayoutPreview; geometry: LayoutPreviewGeometry } =
		$props();

	const slide: PptxSlide = $derived({
		id: `layout-preview-${preview.path}`,
		rId: '',
		slideNumber: 0,
		elements: (preview.elements ?? []).slice(0, MAX_PREVIEW_ELEMENTS),
		backgroundColor: geometry.backgroundColor,
	});
</script>

<SlideStage
	{slide}
	canvasSize={{ width: geometry.surfaceWidth, height: geometry.surfaceHeight }}
	mediaDataUrls={EMPTY_MEDIA}
	scale={1}
/>
