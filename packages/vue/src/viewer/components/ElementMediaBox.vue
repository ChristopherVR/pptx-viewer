<script setup lang="ts">
/**
 * ElementMediaBox: the `media` branch of `ElementRenderer`, extracted to keep
 * the dispatcher thin. Plays a `<video>`/`<audio>` when a source is available,
 * else a poster `<img>`, else a placeholder. On the interactive (edit) canvas
 * controls are suppressed + pointer-events off so clicks select/move the
 * element; preview/present play normally.
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	MEDIA_PLAY_BADGE_POINTS,
	applyMediaPlaybackAttributes,
	mediaFallbackVisual,
	mediaPlaybackAttributes,
	mediaSurfaceOf,
	mediaTransportVisible,
	startMediaAutoplay,
} from 'pptx-viewer-shared';
import type { MediaPlaybackSource } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { registerCrossSlideAudio } from '../composables/cross-slide-audio';
import { getContainerStyle, getImageSrc } from '../composables/element-style';

const props = defineProps<{
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
	interactive?: boolean;
	/** Emit the data-pptx-element marker even when not interactive (template layer). */
	marked?: boolean;
	/**
	 * True only on the live presentation stage: the media element should then
	 * begin playing on its own (as PowerPoint does when a slide with media
	 * becomes active), rather than waiting for a manual click.
	 */
	presenting?: boolean;
}>();

const { t } = useI18n();

/** The live `<video>`/`<audio>` node (only one is mounted at a time). */
const mediaEl = ref<HTMLVideoElement | HTMLAudioElement | null>(null);

const trimStartMs = computed(() =>
	props.element.type === 'media' ? props.element.trimStartMs : undefined,
);

/**
 * The deck's authored playback settings (`loop` / `vol` / playback rate) for
 * this node, or nothing when the element is not media.
 */
const playbackSource = computed<MediaPlaybackSource>(() =>
	props.element.type === 'media' ? props.element : {},
);

/**
 * Autoplay on the presentation stage: start playback once the element is
 * mounted and `presenting` is on; pause again if the stage is torn down or the
 * element leaves present mode. Delegates the `.play()` + blocked-autoplay
 * handling to the shared helper so all three bindings behave identically.
 *
 * The authored playback settings are pushed onto the live node in the same
 * pass, because `volume` and `playbackRate` are IDL properties with no
 * attribute form: a template binding cannot set them the way it sets `loop`.
 * Without this, `solution-explorer.pptx` slide 2 (`vol="0"`) played at full
 * volume here while React honoured the deck.
 */
watch(
	[mediaEl, () => props.presenting, () => trimStartMs.value, playbackSource],
	([el, presenting]) => {
		if (!el) {
			return;
		}
		applyMediaPlaybackAttributes(el, playbackSource.value);
		if (presenting) {
			// "Play across slides" audio: a hidden document-level element (the shared
			// persistent-audio manager) carries the sound so it survives this slide's
			// unmount when the show advances. The slide-local copy must then stay
			// silent, or the track doubles while its own slide is up.
			if (
				props.element.type === 'media' &&
				registerCrossSlideAudio(props.element, mediaSrc.value)
			) {
				el.muted = true;
				if (!el.paused) {
					el.pause();
				}
				return;
			}
			void nextTick(() => startMediaAutoplay(el, { trimStartMs: trimStartMs.value }));
		} else if (!el.paused) {
			el.pause();
		}
	},
	{ immediate: true },
);

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);
const imageSrc = computed(() => getImageSrc(props.element, props.mediaDataUrls));
/** Playable source (mediaData URL or resolved mediaPath). */
const mediaSrc = computed(() => {
	const el = props.element;
	if (el.type !== 'media') {
		return undefined;
	}
	return el.mediaData ?? (el.mediaPath ? props.mediaDataUrls.get(el.mediaPath) : undefined);
});
const mediaKind = computed(() =>
	props.element.type === 'media' ? props.element.mediaType : undefined,
);

/**
 * The frame PowerPoint paints before the video decodes one of its own: the
 * `p:pic`'s `blipFill` (parsed into `posterFrameData`), falling back to the
 * element's own image data.
 *
 * Without it a full-bleed background video is a hole in the slide until the
 * browser decodes a frame, and with `preload="metadata"` it never does: the
 * whole slide renders as a flat empty stage. React has always passed one.
 */
const posterSrc = computed(() =>
	props.element.type === 'media'
		? (props.element.posterFrameData ?? imageSrc.value)
		: imageSrc.value,
);

/** `<a:videoFile>` loop / autoplay flags parsed off the slide. */
const shouldLoop = computed(() => mediaPlaybackAttributes(playbackSource.value).loop);
const shouldAutoPlay = computed(
	() => props.element.type === 'media' && props.element.autoPlay === true,
);

/**
 * Native transport is an authoring affordance, not part of a slide show:
 * PowerPoint's show plays media without a browser control bar painted across
 * the slide. This mirrors React's `controls={!isPresentationMode}`; the flag
 * was inverted here, so the editor hid the controls and the SHOW displayed
 * them over the deck.
 *
 * A stage that is neither interactive nor presenting is a STILL of a slide (the
 * presenter console's panes, the thumbnail rail), and `!presenting` alone put
 * Chrome's scrubber across those too: the presenter console painted a control
 * bar over a slide the speaker cannot play. The rule now comes from shared.
 */
const surface = computed(() =>
	mediaSurfaceOf({
		interactive: props.interactive === true,
		presenting: props.presenting === true,
	}),
);

const showControls = computed(() =>
	mediaTransportVisible({ ...surface.value, canvasTransport: true }),
);

/**
 * What to paint when no `<video>`/`<audio>` can be mounted.
 *
 * A still of a slide - the slide-transition overlay, the presenter console's
 * panes, the thumbnail rail - gets the poster frame and nothing else: the play
 * badge and the typed placeholder box are authoring chrome, and issue #147 is
 * exactly that chrome riding along inside a morph. The rule is shared so the
 * five bindings cannot drift on it.
 */
const fallback = computed(() =>
	mediaFallbackVisual(surface.value, {
		hasPoster: Boolean(posterSrc.value),
		missing: props.element.type === 'media' && props.element.mediaMissing === true,
	}),
);

/** The play triangle, as a shared `<polygon points>` in a 24x24 viewBox. */
const playBadgePoints = MEDIA_PLAY_BADGE_POINTS;
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-media"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive || marked ? 'true' : undefined"
	>
		<video
			v-if="mediaSrc && mediaKind === 'video'"
			ref="mediaEl"
			:src="mediaSrc"
			:controls="showControls"
			:poster="posterSrc"
			:loop="shouldLoop"
			:autoplay="shouldAutoPlay"
			:muted="shouldAutoPlay && !presenting"
			preload="metadata"
			playsinline
			:style="{
				width: '100%',
				height: '100%',
				objectFit: 'contain',
				display: 'block',
				pointerEvents: interactive ? 'none' : 'auto',
			}"
		/>
		<audio
			v-else-if="mediaSrc && mediaKind === 'audio'"
			ref="mediaEl"
			:src="mediaSrc"
			:controls="showControls"
			:loop="shouldLoop"
			:autoplay="shouldAutoPlay"
			:style="{ width: '100%', pointerEvents: interactive ? 'none' : 'auto' }"
		/>
		<template v-else-if="fallback.poster && posterSrc">
			<img
				:src="posterSrc"
				alt=""
				:style="{
					width: '100%',
					height: '100%',
					objectFit: 'contain',
					display: 'block',
					opacity: fallback.dimPoster ? 0.5 : undefined,
				}"
			/>
			<!-- Authoring-canvas chrome only; `data-pptx-media-chrome` is the neutral
			     marker `e2e/media-transition-chrome.spec.ts` asserts the absence of. -->
			<svg
				v-if="fallback.badge"
				data-pptx-media-chrome="play"
				class="pptx-vue-media-badge"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<polygon :points="playBadgePoints" />
			</svg>
		</template>
		<div
			v-else-if="fallback.placeholder"
			class="pptx-vue-placeholder"
			data-pptx-media-chrome="placeholder"
		>
			{{ t('pptx.elementType.media') }}
		</div>
	</div>
</template>

<style scoped>
/* The host `.pptx-vue-media` is already absolutely positioned by
   `getContainerStyle`, so the badge centres against the element's own box. */
.pptx-vue-media-badge {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 48px;
	height: 48px;
	transform: translate(-50%, -50%);
	color: rgba(255, 255, 255, 0.8);
	filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
	pointer-events: none;
}
</style>
