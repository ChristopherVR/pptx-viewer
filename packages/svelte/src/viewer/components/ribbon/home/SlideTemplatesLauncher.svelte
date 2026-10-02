<script lang="ts">
	/**
	 * SlideTemplatesLauncher: the gallery dialog behind Home > Slides > Slide
	 * Templates. The trigger button is the shared `pptx-ui-ribbon-home-slides`
	 * control; `SlidesGroup` sets `open` when it requests the gallery. This
	 * reads the render context for the deck's parsed colour scheme (so previews
	 * and the inserted slide inherit the theme) and canvas size (so the inserted
	 * elements target the real slide surface), then routes insertion through the
	 * history-integrated `EditorSlidesController.insertSlideFromTemplate` and
	 * navigates to the new slide.
	 */
	import { templateSchemeFromTheme } from 'pptx-viewer-shared';
	import type { SlideTemplateId } from 'pptx-viewer-shared';

	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { getRenderContextSource } from '../../../state/render-context';
	import SlideTemplateGalleryDialog from './SlideTemplateGalleryDialog.svelte';

	let {
		editor,
		onnavigate,
		open = $bindable(false),
	}: { editor: EditorState; onnavigate: (index: number) => void; open?: boolean } = $props();
	const renderContext = getRenderContextSource();

	const scheme = $derived(templateSchemeFromTheme(renderContext?.getColorScheme()));

	function insert(templateId: SlideTemplateId): void {
		const canvasSize = renderContext?.getCanvasSize?.();
		const index = editor.slidesOps.insertSlideFromTemplate(templateId, {
			scheme,
			...(canvasSize ? { slideWidth: canvasSize.width, slideHeight: canvasSize.height } : {}),
		});
		open = false;
		if (index !== null) {
			onnavigate(index);
		}
	}
</script>

{#if open}
	<SlideTemplateGalleryDialog {scheme} oncancel={() => (open = false)} oninsert={insert} />
{/if}
