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
const NATIVE_STYLE_ELEMENT_ID = 'pptx-svelte-native-keyframes';

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

/**
 * Upsert the current slide's native-animation `@keyframes` (`p:animClr` colour
 * ramps, staged builds, etc.) into a dedicated head-level `<style>`. Keyframe
 * rules are global, so a single head-level injection reaches the windowed stage
 * and the fullscreen element alike (mirrors the Vue binding rendering
 * `presentationKeyframesCss` in its presentation template). Passing an empty
 * string clears the rules (e.g. on slide change / leaving presentation).
 */
export function syncNativeAnimationKeyframes(css: string): void {
	if (typeof document === 'undefined') {
		return;
	}
	let style = document.getElementById(NATIVE_STYLE_ELEMENT_ID);
	if (!css) {
		style?.remove();
		return;
	}
	if (!style) {
		style = document.createElement('style');
		style.id = NATIVE_STYLE_ELEMENT_ID;
		document.head.appendChild(style);
	}
	if (style.textContent !== css) {
		style.textContent = css;
	}
}
