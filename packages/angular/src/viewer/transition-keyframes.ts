/**
 * transition-keyframes.ts: document-level injection of the slide-transition
 * `@keyframes` block.
 *
 * WHY a module-level helper: CSS `@keyframes` are global rules, so an Angular
 * component's view-encapsulated `styles` cannot host them. Both the
 * presentation transition overlay and the inspector's transition preview drive
 * elements with the `animation` shorthand, so both need the same keyframe names
 * present in the document head. Sharing one idempotent injector keeps a single
 * `<style>` element for the whole app instead of one per component instance.
 *
 * SSR/test-safe: a no-op when there is no `document`.
 *
 * @module viewer/transition-keyframes
 */
import { SLIDE_TRANSITION_KEYFRAMES } from './transition-helpers';

/** DOM id of the singleton `<style>` tag holding the transition keyframes. */
export const TRANSITION_KEYFRAMES_STYLE_ID = 'pptx-ng-slide-transition-keyframes';

/** Ensure the slide-transition `@keyframes` are in the document head, once. */
export function ensureTransitionKeyframes(): void {
	if (typeof document === 'undefined') {
		return;
	}
	if (document.getElementById(TRANSITION_KEYFRAMES_STYLE_ID)) {
		return;
	}
	const style = document.createElement('style');
	style.id = TRANSITION_KEYFRAMES_STYLE_ID;
	style.textContent = SLIDE_TRANSITION_KEYFRAMES;
	document.head.appendChild(style);
}
