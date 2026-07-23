/**
 * `presentation-keyframes`: DOM helpers for injecting the animation `@keyframes`
 * an Angular slide show needs.
 *
 * Native-animation playback drives elements with the CSS-animation shorthand
 * (`element.style.animation = "<keyframe-name> ..."`). Those keyframes come from
 * two sources, both injected into the document head (keyframes are global, so an
 * Angular component's scoped `<style>` cannot host them):
 *
 *  - {@link ANIMATION_KEYFRAMES_CSS}: the static preset keyframe library
 *    (fadeIn / flyIn / wipe / ...), injected ONCE per document.
 *  - the controller's per-slide `keyframesCss` (`p:animClr` colour stops + staged
 *    text-build keyframes), managed by a per-show `<style>` element updated on
 *    each slide change.
 *
 * Mirrors the Vue `PresentationMode.vue`, which injects the same two CSS sources
 * via a `<style>` in its overlay template.
 *
 * @module viewer/presentation-keyframes
 */

import { ANIMATION_KEYFRAMES_CSS } from '../internal/shared';

let presetInjected = false;

/** Inject the static preset `@keyframes` library once per document. */
export function ensurePresetAnimationKeyframes(): void {
	if (presetInjected || typeof document === 'undefined') {
		return;
	}
	const style = document.createElement('style');
	style.setAttribute('data-pptx-ng-animation-keyframes', '');
	style.textContent = ANIMATION_KEYFRAMES_CSS;
	document.head.appendChild(style);
	presetInjected = true;
}

/** A managed per-slide keyframes `<style>` element. */
export interface SlideKeyframesStyle {
	/** Replace the element's CSS with this slide's keyframes. */
	set(css: string): void;
	/** Remove the managed `<style>` element from the document. */
	dispose(): void;
}

/** Create a managed per-slide keyframes `<style>` element (no-op under SSR). */
export function createSlideKeyframesStyle(): SlideKeyframesStyle {
	if (typeof document === 'undefined') {
		return { set: () => {}, dispose: () => {} };
	}
	const style = document.createElement('style');
	style.setAttribute('data-pptx-ng-slide-keyframes', '');
	document.head.appendChild(style);
	return {
		set: (css: string) => {
			style.textContent = css;
		},
		dispose: () => {
			style.remove();
		},
	};
}
