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
		MEDIA_FULLSCREEN_OVERLAY_STYLE,
		applyMediaPlaybackAttributes,
		isMediaFullscreenActive,
		mediaFallbackIcon,
		mediaFallbackLabelKey,
		mediaFallbackVisual,
		mediaPlaybackAttributes,
		mediaSurfaceOf,
		mediaTransportVisible,
		scheduleMediaTrimAndFade,
		shouldRenderHitTarget,
		shouldShowMediaFullscreenStopButton,
		startMediaAutoplay,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { registerCrossSlideAudio, resolveMediaView } from '../render';
	import { getContainerStyle, getElementHitTargetStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const {
		element,
		mediaDataUrls,
		zIndex,
		presenting = false,
		interactive = false,
		marked = false,
		editable = false,
	}: ElementRendererProps = $props();
	const t = useTranslator();

	/** Interaction-only hit target for a degenerate media box (issue #285); see `ElementRenderer`. */
	const hitTarget = $derived(shouldRenderHitTarget(editable, presenting) ? getElementHitTargetStyle(element) : undefined);

	const media = $derived(element.type === 'media' ? element : undefined);
	const view = $derived(media ? resolveMediaView(media, mediaDataUrls) : undefined);

	/**
	 * `fullScrn` full-slide playback overlay (issue wave item 10): the shared
	 * trigger + style live in `pptx-viewer-shared` (`media-fullscreen.ts`); this
	 * component only tracks the mounted node's native play/pause state
	 * (mirrors Vue's `useMediaFullscreen` / Angular's `fullscreenActive`).
	 */
	let isPlaying = $state(false);
	const fullscreenInput = $derived({
		fullScreen: media?.fullScreen,
		presenting,
		playing: isPlaying,
	});
	const fullscreenActive = $derived(isMediaFullscreenActive(fullscreenInput));
	const showFullscreenStop = $derived(shouldShowMediaFullscreenStopButton(fullscreenInput));

	const containerStyle = $derived(
		styleToString(
			fullscreenActive
				? { ...getContainerStyle(element, zIndex), ...MEDIA_FULLSCREEN_OVERLAY_STYLE }
				: getContainerStyle(element, zIndex),
		),
	);
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
			// G20: trim-end stop + fade in/out, shared with the other four
			// bindings so a trimmed/faded clip behaves identically everywhere
			// (this used to be React-only logic).
			return scheduleMediaTrimAndFade(el, {
				trimStartMs: source.trimStartMs,
				trimEndMs: source.trimEndMs,
				fadeInDuration: source.fadeInDuration,
				fadeOutDuration: source.fadeOutDuration,
				volume: mediaPlaybackAttributes(source).volume,
			});
		} else if (!el.paused) {
			el.pause();
		}
	});

	// Tracks native play/pause/ended so `fullscreenActive` reflects PowerPoint's
	// own rule: the full-slide layout appears once the clip actually starts,
	// not merely because the slide holding it became active. Mirrors Vue's
	// `useMediaFullscreen` / Angular's `isPlaying` signal.
	$effect(() => {
		const el = mediaEl;
		if (!el) {
			isPlaying = false;
			return;
		}
		const onPlay = (): void => {
			isPlaying = true;
		};
		const onStop = (): void => {
			isPlaying = false;
		};
		el.addEventListener('play', onPlay);
		el.addEventListener('pause', onStop);
		el.addEventListener('ended', onStop);
		return () => {
			el.removeEventListener('play', onPlay);
			el.removeEventListener('pause', onStop);
			el.removeEventListener('ended', onStop);
		};
	});

	/** Pauses the mounted media, dropping the overlay back to inline. */
	function stopFullscreen(): void {
		if (mediaEl && !mediaEl.paused) {
			mediaEl.pause();
		}
	}
</script>

{#if media && view}
	<div
		class="pptx-svelte-element pptx-svelte-media"
		class:pptx-svelte-media-fallback={isFallback}
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive || marked ? 'true' : undefined}
	>
		<!-- Interaction-only hit target for a degenerate media box; see `hitTarget`.
		     Joined tight against the next block: a bare newline between two
		     top-level `{#if}`s survives as a real, permanently-rendered space
		     text node (neither block is then at the children-list edge), which
		     broke the empty-textContent assertion for a media element with no
		     playable source and no fallback chrome. -->
		{#if hitTarget}<div aria-hidden="true" data-pptx-hit-target="true" style={styleToString(hitTarget)}></div>{/if}{#if view.mediaSrc && media.mediaType === 'video'}
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
		<!-- Stop/close affordance for the fullScrn full-slide overlay (issue
		     wave item 10). Inline pointer-events: the root's own may be forced
		     to none while non-interactive, and a descendant can always
		     re-enable itself regardless of the ancestor's computed value. -->
		{/if}{#if showFullscreenStop}
			<button
				type="button"
				class="pptx-svelte-media-fullscreen-stop"
				style="pointer-events: auto"
				aria-label={t('pptx.media.stopFullscreenAria')}
				onclick={stopFullscreen}
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
					<rect x="6" y="6" width="12" height="12" rx="1" />
				</svg>
			</button>
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

	.pptx-svelte-media-fullscreen-stop {
		position: absolute;
		bottom: 12px;
		right: 12px;
		z-index: 30;
		border: none;
		border-radius: 9999px;
		background: rgba(0, 0, 0, 0.5);
		color: rgba(255, 255, 255, 0.8);
		padding: 8px;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.pptx-svelte-media-fullscreen-stop:hover {
		background: rgba(0, 0, 0, 0.7);
		color: #fff;
	}
</style>
