import { ANIMATION_KEYFRAMES_CSS, SLIDE_TRANSITION_KEYFRAMES_CSS } from 'pptx-viewer-shared';

/**
 * `keyframes`: inject the shared `@keyframes` blocks the presentation mode
 * relies on (element-animation `pptx-vue-*` and slide-transition `pptx-tr-*`)
 * once into the document head. Keyframe rules are global regardless of where
 * the `<style>` lives, so a single head-level injection applies to the windowed
 * stage and to the fullscreen element alike.
 *
 * Idempotent and safe to call repeatedly (e.g. every time presentation starts).
 */

const STYLE_ELEMENT_ID = 'pptx-svelte-presentation-keyframes';

/** Ensure the presentation `@keyframes` are present in the document head. */
export function ensurePresentationKeyframes(): void {
	if (typeof document === 'undefined') {
		return;
	}
	if (document.getElementById(STYLE_ELEMENT_ID)) {
		return;
	}
	const style = document.createElement('style');
	style.id = STYLE_ELEMENT_ID;
	style.textContent = `${ANIMATION_KEYFRAMES_CSS}\n${SLIDE_TRANSITION_KEYFRAMES_CSS}`;
	document.head.appendChild(style);
}
