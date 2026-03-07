/**
 * CSS @keyframes definitions for PowerPoint slide transitions.
 *
 * Injected once via a <style> element to provide transition animations
 * for outgoing (old) and incoming (new) slide layers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideTransitionAnimations {
  /** CSS animation string for the outgoing (old) slide layer. */
  outgoing: string;
  /** CSS animation string for the incoming (new) slide layer. */
  incoming: string;
  /** Whether the outgoing layer should render on top of the incoming layer. */
  outgoingOnTop: boolean;
}

// ---------------------------------------------------------------------------
// CSS @keyframes (injected once via <style>)
// ---------------------------------------------------------------------------

export const SLIDE_TRANSITION_KEYFRAMES = `
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
/* Cover diagonals */
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
/* Uncover diagonals */
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

/* ── Wheel ──────────────────────────────────────────────────────── */
@keyframes pptx-tr-wheel-in {
	from { clip-path: circle(0% at 50% 50%); transform: rotate(-180deg); }
	to   { clip-path: circle(75% at 50% 50%); transform: rotate(0deg); }
}
`;
