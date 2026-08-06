<script lang="ts">
	/**
	 * SlideTemplatesLauncher: the Home > Slides group's "Slide Templates"
	 * button plus the gallery dialog it opens (React parity: the button sits
	 * between New Slide and Layout). Split out of `SlidesGroup` for the repo's
	 * file-size budget. It reads the render context for the deck's parsed
	 * colour scheme (so previews and the inserted slide inherit the theme) and
	 * canvas size (so the inserted elements target the real slide surface),
	 * then routes insertion through the history-integrated
	 * `EditorSlidesController.insertSlideFromTemplate` and navigates to the
	 * new slide.
	 */
	import { templateSchemeFromTheme } from 'pptx-viewer-shared';
	import type { SlideTemplateId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { getRenderContextSource } from '../../../state/render-context';
	import SlideTemplateGalleryDialog from './SlideTemplateGalleryDialog.svelte';

	const { editor, onnavigate }: { editor: EditorState; onnavigate: (index: number) => void } =
		$props();
	const t = useTranslator();
	const renderContext = getRenderContextSource();

	let galleryOpen = $state(false);
	const scheme = $derived(templateSchemeFromTheme(renderContext?.getColorScheme()));

	function insert(templateId: SlideTemplateId): void {
		const canvasSize = renderContext?.getCanvasSize?.();
		const index = editor.slidesOps.insertSlideFromTemplate(templateId, {
			scheme,
			...(canvasSize ? { slideWidth: canvasSize.width, slideHeight: canvasSize.height } : {}),
		});
		galleryOpen = false;
		if (index !== null) {
			onnavigate(index);
		}
	}
</script>

<button
	type="button"
	class="pptx-svelte-slide-templates-launch"
	disabled={!editor.editable}
	aria-label={t('pptx.home.slideTemplates')}
	title={t('pptx.home.slideTemplates')}
	onclick={() => (galleryOpen = true)}
>
	<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M2.5 6h11M6.5 6v7.5" stroke="currentColor" stroke-width="1.2" /></svg>
	<span>{t('pptx.home.slideTemplates')}</span>
</button>

{#if galleryOpen}
	<SlideTemplateGalleryDialog
		{scheme}
		oncancel={() => (galleryOpen = false)}
		oninsert={insert}
	/>
{/if}

<style>
	/* Matches SlidesGroup's .pptx-svelte-rgroup-main pill styling. */
	.pptx-svelte-slide-templates-launch {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
		white-space: nowrap;
	}

	.pptx-svelte-slide-templates-launch:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-slide-templates-launch:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-slide-templates-launch svg {
		width: 14px;
		height: 14px;
	}
</style>
