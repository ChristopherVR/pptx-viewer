<script lang="ts">
	/**
	 * MediaBox: renders `media` (audio / video) elements (Svelte port of the
	 * vanilla / Vue media renderer, viewer subset):
	 *
	 * - Playable source cascade: `mediaData` (data URL embedded by the load
	 *   pipeline) first, then `mediaPath` looked up in `mediaDataUrls`.
	 * - Video renders a native `<video>` (with the poster frame when one exists);
	 *   audio renders a native `<audio>`. The native transport is suppressed
	 *   while presenting, as React does (`controls={!isPresentationMode}`):
	 *   PowerPoint shows none, and a full-bleed background video otherwise draws
	 *   Chrome's own black scrubber across the bottom of the slide, on top of the
	 *   presentation toolbar.
	 * - No playable source: the poster / thumbnail image alone.
	 * - Nothing at all: a graceful typed fallback box labelled "Media".
	 *
	 * Presentation-mode autoplay: once the `<video>`/`<audio>` element is
	 * mounted and `presenting` is on (the live fullscreen stage), playback
	 * starts on its own via the shared `startMediaAutoplay` (matches Vue's
	 * `ElementMediaBox.vue`, so all bindings behave identically); it pauses
	 * again when `presenting` turns off.
	 *
	 * Authored playback settings (`loop`, `volume`, `playbackSpeed`) come from the
	 * shared `mediaPlaybackAttributes` / `applyMediaPlaybackAttributes`. Dropping
	 * them is not cosmetic: `e2e/fixtures/solution-explorer.pptx` slide 2 holds a
	 * two-second background video the deck marks `loop` with `vol="0"`, and
	 * without the loop flag it played once, hit its end and froze on the last
	 * frame, which reads exactly like "the video never started".
	 */
	import {
		applyMediaPlaybackAttributes,
		mediaFallbackIcon,
		mediaFallbackLabelKey,
		mediaFallbackVisual,
		mediaPlaybackAttributes,
		mediaSurfaceOf,
		mediaTransportVisible,
		startMediaAutoplay,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { registerCrossSlideAudio, resolveMediaView } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const {
		element,
		mediaDataUrls,
		zIndex,
		presenting = false,
		interactive = false,
		marked = false,
	}: ElementRendererProps = $props();
	const t = useTranslator();

	const media = $derived(element.type === 'media' ? element : undefined);
	const view = $derived(media ? resolveMediaView(media, mediaDataUrls) : undefined);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	const trimStartMs = $derived(media?.trimStartMs);
	// `loop` is a real attribute, so it binds declaratively; `volume` and
	// `playbackRate` are IDL properties with no attribute form and have to be
	// applied imperatively below.
	const playback = $derived(mediaPlaybackAttributes(media ?? {}));
	// A stage that is neither interactive nor presenting is a STILL of a slide
	// (the presenter console's panes, the thumbnail rail), and `!presenting`
	// alone painted Chrome's scrubber across those too: the console drew a
	// control bar over a slide the speaker cannot play. The rule is shared.
	const surface = $derived(mediaSurfaceOf({ interactive, presenting }));
	const showControls = $derived(mediaTransportVisible({ ...surface, canvasTransport: true }));

	/**
	 * What to paint when no `<video>`/`<audio>` can be mounted.
	 *
	 * A still of a slide - the slide-transition overlay, the presenter console's
	 * panes, the thumbnail rail - gets the poster frame and nothing else: the
	 * play badge and the typed placeholder box are authoring chrome, and issue
	 * #147 is exactly that chrome riding along inside a morph. The rule is shared
	 * so the five bindings cannot drift on it.
	 */
	const fallback = $derived(
		mediaFallbackVisual(surface, {
			hasPoster: Boolean(view?.posterSrc),
			missing: media?.mediaMissing === true,
		}),
	);
	/** The shared icon paths and label key for whatever the fallback resolved to. */
	const fallbackIcon = $derived(mediaFallbackIcon(fallback, media?.mediaType));
	const fallbackLabelKey = $derived(mediaFallbackLabelKey(fallback, media?.mediaType));
	const isFallback = $derived(
		view !== undefined && !view.mediaSrc && fallback.placeholder !== 'none',
	);

	// The conditionally-rendered `<video>`/`<audio>` template's `bind:this`
	// writes this (invisible to the linter); it must be `$state` so Svelte
	// re-binds it as the element enters/leaves the DOM across template
	// branches (same pattern as Model3dView's `sceneHost`).
	// eslint-disable-next-line prefer-const, no-unassigned-vars
	let mediaEl: HTMLVideoElement | HTMLAudioElement | undefined = $state();

	$effect(() => {
		const el = mediaEl;
		// Track trimStartMs so a change while already presenting re-seeks.
		const trim = trimStartMs;
		// Read the element itself so an authored volume / speed change re-applies.
		const source = media;
		if (!el || !source) {
			return;
		}
		// Applied BEFORE playback starts, so a `vol="0"` clip never blares out
		// during its first frames while effects settle.
		applyMediaPlaybackAttributes(el, source);
		if (presenting) {
			// "Play across slides" audio: a hidden document-level element (the shared
			// persistent-audio manager) carries the sound so it survives this slide's
			// unmount when the show advances. The slide-local copy must then stay
			// silent, or the track doubles while its own slide is up.
			if (registerCrossSlideAudio(source, view?.mediaSrc)) {
				el.muted = true;
				if (!el.paused) {
					el.pause();
				}
				return;
			}
			startMediaAutoplay(el, { trimStartMs: trim });
		} else if (!el.paused) {
			el.pause();
		}
	});
</script>

{#if media && view}
	<div
		class="pptx-svelte-element pptx-svelte-media"
		class:pptx-svelte-media-fallback={isFallback}
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive || marked ? 'true' : undefined}
	>
		{#if view.mediaSrc && media.mediaType === 'video'}
			<!-- svelte-ignore a11y_media_has_caption -- source PPTX media carries no caption track -->
			<video
				bind:this={mediaEl}
				class="pptx-svelte-media-video"
				src={view.mediaSrc}
				poster={view.posterSrc}
				controls={showControls}
				loop={playback.loop}
				preload="metadata"
				playsinline
			></video>
		{:else if view.mediaSrc && media.mediaType === 'audio'}
			<audio
				bind:this={mediaEl}
				class="pptx-svelte-media-audio"
				src={view.mediaSrc}
				controls={showControls}
				loop={playback.loop}
			></audio>
		{:else if fallback.poster && view.posterSrc}
			<img
				class="pptx-svelte-media-poster"
				class:pptx-svelte-media-dim={fallback.dimPoster}
				src={view.posterSrc}
				alt=""
			/>
			<!-- Authoring-canvas chrome only; `data-pptx-media-chrome` is the neutral
			     marker `e2e/media-transition-chrome.spec.ts` asserts the absence of. -->
			{#if fallback.badge !== 'none'}
				<div
					data-pptx-media-chrome={fallback.badge}
					class="pptx-svelte-media-badge"
					class:pptx-svelte-media-badge-missing={fallback.badge === 'missing'}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						{#each fallbackIcon as d (d)}
							<path {d} />
						{/each}
					</svg>
					{#if fallbackLabelKey && fallback.badge === 'missing'}
						<span>{t(fallbackLabelKey)}</span>
					{/if}
				</div>
			{/if}
		{:else if fallback.placeholder !== 'none'}
			<div class="pptx-svelte-media-placeholder" data-pptx-media-chrome={fallback.placeholder}>
				{#if fallbackIcon.length > 0}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						{#each fallbackIcon as d (d)}
							<path {d} />
						{/each}
					</svg>
				{/if}
				{#if fallbackLabelKey}
					<span>{t(fallbackLabelKey)}</span>
				{/if}
			</div>
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

	/* A poster standing in for media the package could not resolve. */
	.pptx-svelte-media-dim {
		opacity: 0.5;
	}

	.pptx-svelte-media-badge {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		color: rgba(255, 255, 255, 0.8);
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
		pointer-events: none;
		font-size: 11px;
		font-family: system-ui, sans-serif;
	}

	.pptx-svelte-media-badge svg {
		width: 48px;
		height: 48px;
	}

	.pptx-svelte-media-badge-missing {
		color: rgba(255, 255, 255, 0.6);
	}

	.pptx-svelte-media-badge-missing svg {
		width: 32px;
		height: 32px;
	}

	.pptx-svelte-media-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		font-size: 11px;
		font-family: system-ui, sans-serif;
		color: rgba(100, 116, 139, 0.9);
	}

	.pptx-svelte-media-placeholder svg {
		width: 32px;
		height: 32px;
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


</style>
