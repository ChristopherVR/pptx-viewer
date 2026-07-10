<script lang="ts">
	/**
	 * MediaBox: renders `media` (audio / video) elements (Svelte port of the
	 * vanilla / Vue media renderer, viewer subset):
	 *
	 * - Playable source cascade: `mediaData` (data URL embedded by the load
	 *   pipeline) first, then `mediaPath` looked up in `mediaDataUrls`.
	 * - Video renders a native `<video controls>` (with the poster frame when
	 *   one exists); audio renders a native `<audio controls>`.
	 * - No playable source: the poster / thumbnail image alone.
	 * - Nothing at all: a graceful typed fallback box labelled "Media".
	 */
	import { useTranslator } from '../../i18n/context';
	import { resolveMediaView } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, mediaDataUrls, zIndex }: ElementRendererProps = $props();
	const t = useTranslator();

	const media = $derived(element.type === 'media' ? element : undefined);
	const view = $derived(media ? resolveMediaView(media, mediaDataUrls) : undefined);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	const isFallback = $derived(view !== undefined && !view.mediaSrc && !view.posterSrc);
</script>

{#if media && view}
	<div
		class="pptx-svelte-element pptx-svelte-media"
		class:pptx-svelte-media-fallback={isFallback}
		style={containerStyle}
		data-element-id={element.id}
	>
		{#if view.mediaSrc && media.mediaType === 'video'}
			<!-- svelte-ignore a11y_media_has_caption -- source PPTX media carries no caption track -->
			<video
				class="pptx-svelte-media-video"
				src={view.mediaSrc}
				poster={view.posterSrc}
				controls
				preload="metadata"
				playsinline
			></video>
		{:else if view.mediaSrc && media.mediaType === 'audio'}
			<audio class="pptx-svelte-media-audio" src={view.mediaSrc} controls></audio>
		{:else if view.posterSrc}
			<img class="pptx-svelte-media-poster" src={view.posterSrc} alt="" />
		{:else}
			<span class="pptx-svelte-media-fallback-label">{t('pptx.elementType.media')}</span>
		{/if}
	</div>
{/if}

<style>
	.pptx-svelte-media-video,
	.pptx-svelte-media-poster {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.pptx-svelte-media-audio {
		width: 100%;
	}

	/* Unavailable media: reuse the placeholder look for a graceful fallback. */
	.pptx-svelte-media-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed rgba(100, 116, 139, 0.6);
		border-radius: 4px;
		background: rgba(148, 163, 184, 0.08);
		overflow: hidden;
	}

	.pptx-svelte-media-fallback-label {
		font-size: 11px;
		font-family: system-ui, sans-serif;
		color: rgba(100, 116, 139, 0.9);
	}
</style>
