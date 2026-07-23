/**
 * `slide-transition-keyframes` — the full `@keyframes` block backing every
 * resolved slide transition. Inject it once per overlay via a `<style>` element
 * (the same pattern the element-animation engine uses for
 * `ANIMATION_KEYFRAMES_CSS`).
 *
 * Keyframe names are `pptx-tr-*`-prefixed so they never collide with the
 * element-animation keyframes (`pptx-vue-*`) or the native-animation timeline
 * keyframes (`pptx-tl-*`).
 *
 * Both {@link SLIDE_TRANSITION_KEYFRAMES} and the `*_CSS` alias point at the
 * same string — the bindings historically exported it under both names, so the
 * alias preserves their public surface.
 *
 * The faithful Office 2010 (`p14`) keyframes are appended (via
 * {@link P14_TRANSITION_KEYFRAMES_ALL}) so the exotic / 3-D transitions routed
 * through `getP14TransitionAnimations` animate wherever this block is injected,
 * with no per-binding wiring.
 *
 * @module render/slide-transition-keyframes
 */

import { P14_TRANSITION_KEYFRAMES_ALL } from './p14-transition-keyframes';
import { CINEMATIC_TRANSITION_KEYFRAMES } from './slide-transition-cinematic';

const CORE_SLIDE_TRANSITION_KEYFRAMES = `
/* ── Fade ───────────────────────────────────────────────────────────── */
@keyframes pptx-tr-fade-in {
	from { opacity: 0; }
	to   { opacity: 1; }
}
@keyframes pptx-tr-fade-out {
	from { opacity: 1; }
	to   { opacity: 0; }
}

/* ── Push ───────────────────────────────────────────────────────────── */
@keyframes pptx-tr-push-in-from-right {
	from { transform: translateX(100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-push-out-to-left {
	from { transform: translateX(0); }
	to   { transform: translateX(-100%); }
}
@keyframes pptx-tr-push-in-from-left {
	from { transform: translateX(-100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-push-out-to-right {
	from { transform: translateX(0); }
	to   { transform: translateX(100%); }
}
@keyframes pptx-tr-push-in-from-bottom {
	from { transform: translateY(100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-push-out-to-top {
	from { transform: translateY(0); }
	to   { transform: translateY(-100%); }
}
@keyframes pptx-tr-push-in-from-top {
	from { transform: translateY(-100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-push-out-to-bottom {
	from { transform: translateY(0); }
	to   { transform: translateY(100%); }
}

/* ── Cover (incoming slides over stationary outgoing) ───────────────── */
@keyframes pptx-tr-cover-from-right {
	from { transform: translateX(100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-cover-from-left {
	from { transform: translateX(-100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-cover-from-bottom {
	from { transform: translateY(100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-cover-from-top {
	from { transform: translateY(-100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-cover-from-lu {
	from { transform: translate(-100%, -100%); }
	to   { transform: translate(0, 0); }
}
@keyframes pptx-tr-cover-from-ld {
	from { transform: translate(-100%, 100%); }
	to   { transform: translate(0, 0); }
}
@keyframes pptx-tr-cover-from-ru {
	from { transform: translate(100%, -100%); }
	to   { transform: translate(0, 0); }
}
@keyframes pptx-tr-cover-from-rd {
	from { transform: translate(100%, 100%); }
	to   { transform: translate(0, 0); }
}

/* ── Uncover (outgoing slides away revealing stationary incoming) ──── */
@keyframes pptx-tr-uncover-to-left {
	from { transform: translateX(0); }
	to   { transform: translateX(-100%); }
}
@keyframes pptx-tr-uncover-to-right {
	from { transform: translateX(0); }
	to   { transform: translateX(100%); }
}
@keyframes pptx-tr-uncover-to-top {
	from { transform: translateY(0); }
	to   { transform: translateY(-100%); }
}
@keyframes pptx-tr-uncover-to-bottom {
	from { transform: translateY(0); }
	to   { transform: translateY(100%); }
}
@keyframes pptx-tr-uncover-to-lu {
	from { transform: translate(0, 0); }
	to   { transform: translate(-100%, -100%); }
}
@keyframes pptx-tr-uncover-to-ld {
	from { transform: translate(0, 0); }
	to   { transform: translate(-100%, 100%); }
}
@keyframes pptx-tr-uncover-to-ru {
	from { transform: translate(0, 0); }
	to   { transform: translate(100%, -100%); }
}
@keyframes pptx-tr-uncover-to-rd {
	from { transform: translate(0, 0); }
	to   { transform: translate(100%, 100%); }
}

/* ── Wipe (clip-path reveal) ────────────────────────────────────────── */
@keyframes pptx-tr-wipe-from-left {
	from { clip-path: inset(0 100% 0 0); }
	to   { clip-path: inset(0 0 0 0); }
}
@keyframes pptx-tr-wipe-from-right {
	from { clip-path: inset(0 0 0 100%); }
	to   { clip-path: inset(0 0 0 0); }
}
@keyframes pptx-tr-wipe-from-top {
	from { clip-path: inset(0 0 100% 0); }
	to   { clip-path: inset(0 0 0 0); }
}
@keyframes pptx-tr-wipe-from-bottom {
	from { clip-path: inset(100% 0 0 0); }
	to   { clip-path: inset(0 0 0 0); }
}

/* ── Split ──────────────────────────────────────────────────────────── */
@keyframes pptx-tr-split-h-out {
	from { clip-path: inset(0 50%); }
	to   { clip-path: inset(0 0); }
}
@keyframes pptx-tr-split-v-out {
	from { clip-path: inset(50% 0); }
	to   { clip-path: inset(0 0); }
}
@keyframes pptx-tr-split-h-in {
	from { clip-path: inset(0 0); }
	to   { clip-path: inset(0 50%); }
}
@keyframes pptx-tr-split-v-in {
	from { clip-path: inset(0 0); }
	to   { clip-path: inset(50% 0); }
}

/* ── Dissolve ───────────────────────────────────────────────────────── */
@keyframes pptx-tr-dissolve-in {
	from { opacity: 0; filter: blur(4px); }
	to   { opacity: 1; filter: blur(0px); }
}

/* ── Circle / Diamond / Plus (clip-path shapes) ─────────────────────── */
@keyframes pptx-tr-circle-in {
	from { clip-path: circle(0% at 50% 50%); }
	to   { clip-path: circle(75% at 50% 50%); }
}
@keyframes pptx-tr-diamond-in {
	from { clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%); }
	to   { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
}
@keyframes pptx-tr-plus-in {
	from {
		clip-path: polygon(
			50% 50%, 50% 50%, 50% 50%, 50% 50%,
			50% 50%, 50% 50%, 50% 50%, 50% 50%,
			50% 50%, 50% 50%, 50% 50%, 50% 50%
		);
	}
	to {
		clip-path: polygon(
			33% 0%, 66% 0%, 66% 33%, 100% 33%,
			100% 66%, 66% 66%, 66% 100%, 33% 100%,
			33% 66%, 0% 66%, 0% 33%, 33% 33%
		);
	}
}

/* ── Wedge ──────────────────────────────────────────────────────────── */
@keyframes pptx-tr-wedge-in {
	from { clip-path: polygon(50% 0%, 50% 0%, 50% 0%); }
	to   { clip-path: polygon(50% 0%, 100% 100%, 0% 100%); }
}

/* ── Zoom ───────────────────────────────────────────────────────────── */
@keyframes pptx-tr-zoom-in {
	from { transform: scale(0); opacity: 0; }
	to   { transform: scale(1); opacity: 1; }
}
@keyframes pptx-tr-zoom-out {
	from { transform: scale(1); opacity: 1; }
	to   { transform: scale(2); opacity: 0; }
}

/* ── Blinds ─────────────────────────────────────────────────────────── */
@keyframes pptx-tr-blinds-h {
	from { clip-path: inset(0 0 100% 0); }
	to   { clip-path: inset(0); }
}
@keyframes pptx-tr-blinds-v {
	from { clip-path: inset(0 100% 0 0); }
	to   { clip-path: inset(0); }
}

/* ── Checker (approximate with dissolve + contrast) ─────────────────── */
@keyframes pptx-tr-checker-in {
	from { opacity: 0; filter: contrast(2) blur(2px); }
	to   { opacity: 1; filter: contrast(1) blur(0); }
}

/* ── Comb ───────────────────────────────────────────────────────────── */
@keyframes pptx-tr-comb-h {
	from { clip-path: inset(0 100% 0 0); }
	to   { clip-path: inset(0); }
}
@keyframes pptx-tr-comb-v {
	from { clip-path: inset(100% 0 0 0); }
	to   { clip-path: inset(0); }
}

/* ── Strips (diagonal) ──────────────────────────────────────────────── */
@keyframes pptx-tr-strips-lu {
	from { clip-path: polygon(0% 0%, 0% 0%, 0% 0%); }
	to   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
}
@keyframes pptx-tr-strips-ld {
	from { clip-path: polygon(0% 100%, 0% 100%, 0% 100%); }
	to   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
}
@keyframes pptx-tr-strips-ru {
	from { clip-path: polygon(100% 0%, 100% 0%, 100% 0%); }
	to   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
}
@keyframes pptx-tr-strips-rd {
	from { clip-path: polygon(100% 100%, 100% 100%, 100% 100%); }
	to   { clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
}

/* ── RandomBar ──────────────────────────────────────────────────────── */
@keyframes pptx-tr-randombar-h {
	from { opacity: 0; clip-path: inset(0 0 100% 0); }
	to   { opacity: 1; clip-path: inset(0); }
}
@keyframes pptx-tr-randombar-v {
	from { opacity: 0; clip-path: inset(0 100% 0 0); }
	to   { opacity: 1; clip-path: inset(0); }
}

/* ── Newsflash ──────────────────────────────────────────────────────── */
@keyframes pptx-tr-newsflash-in {
	from { transform: rotate(720deg) scale(0); opacity: 0; }
	to   { transform: rotate(0deg) scale(1); opacity: 1; }
}

/* ── Wheel ──────────────────────────────────────────────────────────── */
@keyframes pptx-tr-wheel-in {
	from { clip-path: circle(0% at 50% 50%); transform: rotate(-180deg); }
	to   { clip-path: circle(75% at 50% 50%); transform: rotate(0deg); }
}
`;

/**
 * The full slide-transition `@keyframes` block: the classic set plus the
 * faithful Office 2010 (`p14`) keyframes, so both the classic and exotic / 3-D
 * transitions animate wherever this single string is injected.
 */
export const SLIDE_TRANSITION_KEYFRAMES = `${CORE_SLIDE_TRANSITION_KEYFRAMES}\n${P14_TRANSITION_KEYFRAMES_ALL}\n${CINEMATIC_TRANSITION_KEYFRAMES}`;

/**
 * Alias of {@link SLIDE_TRANSITION_KEYFRAMES} under the `_CSS` name the Vue
 * binding historically exported.
 */
export const SLIDE_TRANSITION_KEYFRAMES_CSS = SLIDE_TRANSITION_KEYFRAMES;
