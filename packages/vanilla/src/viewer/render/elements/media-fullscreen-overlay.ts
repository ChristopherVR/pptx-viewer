import type { MediaPptxElement } from 'pptx-viewer-core';
import {
	MEDIA_FULLSCREEN_OVERLAY_STYLE,
	isMediaFullscreenActive,
	shouldShowMediaFullscreenStopButton,
} from 'pptx-viewer-shared';
import type { CssStyleMap } from 'pptx-viewer-shared';

import { applyStyleMap, createEl, createSvgEl } from '../dom';
import type { ElementRenderContext } from '../types';

/**
 * `fullScrn` full-slide playback overlay wiring for the vanilla binding
 * (issue wave item 10), extracted from `media.ts` to keep it under the
 * repo's 300-LOC file limit.
 *
 * The trigger and style live in `pptx-viewer-shared` (`media-fullscreen.ts`);
 * this module only tracks a mounted `<video>`/`<audio>`'s native
 * play/pause/ended events and applies/reverts the shared style plus the
 * shared stop affordance, since the vanilla renderer rebuilds the whole
 * stage per navigation and has no persistent reactive binding to do that
 * declaratively (mirrors Vue's `useMediaFullscreen` / Angular's
 * `fullscreenActive` computed / Svelte's `MediaBox.svelte` runes).
 */

/**
 * The container style properties {@link MEDIA_FULLSCREEN_OVERLAY_STYLE}
 * overrides, reverted back to their authored values (or unset, for the three
 * fields the overlay alone introduces: `background`/`transition`/`borderColor`).
 * Setting an empty string via `style.setProperty` unsets the property, same as
 * `removeProperty` (used instead of tracking which keys existed beforehand,
 * since the vanilla renderer has no persistent reactive style object to diff
 * against).
 */
function mediaFullscreenResetStyle(baseStyle: CssStyleMap): CssStyleMap {
	return {
		left: baseStyle['left'] ?? '',
		top: baseStyle['top'] ?? '',
		width: baseStyle['width'] ?? '',
		height: baseStyle['height'] ?? '',
		transform: typeof baseStyle['transform'] === 'string' ? baseStyle['transform'] : 'none',
		zIndex: baseStyle['zIndex'] ?? '',
		background: '',
		transition: '',
		borderColor: '',
	};
}

/** Aria-labelled stop/close affordance for the fullScrn full-slide overlay. */
function buildFullscreenStopButton(
	doc: Document,
	label: string,
	onStop: () => void,
): HTMLButtonElement {
	const button = createEl(doc, 'button', 'pptxv-media-fullscreen-stop', {
		position: 'absolute',
		bottom: '12px',
		right: '12px',
		zIndex: 30,
		border: 'none',
		borderRadius: '9999px',
		background: 'rgba(0, 0, 0, 0.5)',
		color: 'rgba(255, 255, 255, 0.8)',
		padding: '8px',
		cursor: 'pointer',
		pointerEvents: 'auto',
	});
	button.type = 'button';
	button.setAttribute('aria-label', label);
	button.addEventListener('click', onStop);
	const icon = createSvgEl(doc, 'svg', {
		width: 18,
		height: 18,
		viewBox: '0 0 24 24',
		fill: 'currentColor',
		stroke: 'none',
	});
	icon.appendChild(createSvgEl(doc, 'rect', { x: 6, y: 6, width: 12, height: 12, rx: 1 }));
	button.appendChild(icon);
	return button;
}

/**
 * Wires the fullScrn overlay onto a mounted `<video>`/`<audio>`: on `play` it
 * spreads the shared overlay style over the container and shows the shared
 * stop button; on `pause`/`ended` it reverts both. Exported for direct
 * testing.
 */
export function wireMediaFullscreenOverlay(
	doc: Document,
	container: HTMLElement,
	mediaNode: HTMLMediaElement,
	element: MediaPptxElement,
	context: ElementRenderContext,
	baseStyle: CssStyleMap,
): void {
	let stopButton: HTMLButtonElement | null = null;

	const update = (playing: boolean): void => {
		const input = { fullScreen: element.fullScreen, presenting: context.presenting, playing };
		const active = isMediaFullscreenActive(input);
		applyStyleMap(
			container,
			active ? MEDIA_FULLSCREEN_OVERLAY_STYLE : mediaFullscreenResetStyle(baseStyle),
		);
		if (shouldShowMediaFullscreenStopButton(input)) {
			if (!stopButton) {
				stopButton = buildFullscreenStopButton(
					doc,
					context.t('pptx.media.stopFullscreenAria'),
					() => {
						if (!mediaNode.paused) {
							mediaNode.pause();
						}
					},
				);
				container.appendChild(stopButton);
			}
		} else if (stopButton) {
			stopButton.remove();
			stopButton = null;
		}
	};

	mediaNode.addEventListener('play', () => update(true));
	mediaNode.addEventListener('pause', () => update(false));
	mediaNode.addEventListener('ended', () => update(false));
}
