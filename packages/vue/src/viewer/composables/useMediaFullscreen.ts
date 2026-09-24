import type { PptxElement } from 'pptx-viewer-core';
import { MEDIA_FULLSCREEN_OVERLAY_STYLE, isMediaFullscreenActive } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';
import type { ComputedRef, CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';

/** What {@link useMediaFullscreen} returns for `ElementMediaBox.vue` to wire up. */
export interface MediaFullscreenController {
	/** Whether the `fullScrn` full-slide overlay should render right now. */
	active: ComputedRef<boolean>;
	/** The style override to spread over the normal container style while active. */
	overlayStyle: ComputedRef<CSSProperties>;
	/** Aria label for the overlay's stop/close button. */
	stopAriaLabel: ComputedRef<string>;
	/** Pauses the mounted media, dropping the overlay back to inline. */
	stop: () => void;
}

/**
 * `fullScrn` full-slide playback overlay (ECMA-376's media-playback
 * extension, issue wave item 10): PowerPoint plays a clip marked full-screen
 * letterboxed across the whole slide once it starts, instead of at its
 * authored frame. This used to be React-only; the trigger and the resulting
 * style live in `pptx-viewer-shared` (`media-fullscreen.ts`), so this
 * composable only tracks the mounted element's play state and wires the two
 * together, keeping `ElementMediaBox.vue` a thin template.
 *
 * @param element Reactive getter for the element being rendered.
 * @param mediaEl Reactive getter for the mounted `<video>`/`<audio>` node.
 * @param presenting Reactive getter for whether this is the live show stage.
 */
export function useMediaFullscreen(
	element: () => PptxElement,
	mediaEl: () => HTMLVideoElement | HTMLAudioElement | null,
	presenting: () => boolean,
): MediaFullscreenController {
	const { t } = useI18n();
	const isPlaying = ref(false);

	watch(
		mediaEl,
		(el, _prev, onCleanup) => {
			if (!el) {
				isPlaying.value = false;
				return;
			}
			const onPlay = (): void => {
				isPlaying.value = true;
			};
			const onStop = (): void => {
				isPlaying.value = false;
			};
			el.addEventListener('play', onPlay);
			el.addEventListener('pause', onStop);
			el.addEventListener('ended', onStop);
			onCleanup(() => {
				el.removeEventListener('play', onPlay);
				el.removeEventListener('pause', onStop);
				el.removeEventListener('ended', onStop);
			});
		},
		{ immediate: true },
	);

	const active = computed<boolean>(() => {
		const el = element();
		return isMediaFullscreenActive({
			fullScreen: el.type === 'media' ? el.fullScreen : undefined,
			presenting: presenting(),
			playing: isPlaying.value,
		});
	});

	const overlayStyle = computed<CSSProperties>(() =>
		active.value ? (MEDIA_FULLSCREEN_OVERLAY_STYLE as CSSProperties) : {},
	);

	const stopAriaLabel = computed<string>(() => t('pptx.media.stopFullscreenAria'));

	function stop(): void {
		const el = mediaEl();
		if (el && !el.paused) {
			el.pause();
		}
	}

	return { active, overlayStyle, stopAriaLabel, stop };
}
