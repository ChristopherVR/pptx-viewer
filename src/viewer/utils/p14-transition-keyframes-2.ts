/**
 * CSS @keyframes for Office 2010 (p14 namespace) slide transitions - Part 2.
 *
 * Contains keyframes for prism, reveal, ripple, shred, switch,
 * vortex, warp, wheelReverse, and window transitions.
 */

export const P14_TRANSITION_KEYFRAMES_2 = `
/* ── Prism (3D rotation via perspective transform) ───────────────── */
@keyframes pptx-tr-prism-in-from-right {
	from { transform: perspective(800px) rotateY(-90deg) translateX(50%); opacity: 0; }
	to   { transform: perspective(800px) rotateY(0deg) translateX(0); opacity: 1; }
}
@keyframes pptx-tr-prism-out-to-left {
	from { transform: perspective(800px) rotateY(0deg) translateX(0); opacity: 1; }
	to   { transform: perspective(800px) rotateY(90deg) translateX(-50%); opacity: 0; }
}
@keyframes pptx-tr-prism-in-from-left {
	from { transform: perspective(800px) rotateY(90deg) translateX(-50%); opacity: 0; }
	to   { transform: perspective(800px) rotateY(0deg) translateX(0); opacity: 1; }
}
@keyframes pptx-tr-prism-out-to-right {
	from { transform: perspective(800px) rotateY(0deg) translateX(0); opacity: 1; }
	to   { transform: perspective(800px) rotateY(-90deg) translateX(50%); opacity: 0; }
}
@keyframes pptx-tr-prism-in-from-bottom {
	from { transform: perspective(800px) rotateX(90deg) translateY(50%); opacity: 0; }
	to   { transform: perspective(800px) rotateX(0deg) translateY(0); opacity: 1; }
}
@keyframes pptx-tr-prism-out-to-top {
	from { transform: perspective(800px) rotateX(0deg) translateY(0); opacity: 1; }
	to   { transform: perspective(800px) rotateX(-90deg) translateY(-50%); opacity: 0; }
}
@keyframes pptx-tr-prism-in-from-top {
	from { transform: perspective(800px) rotateX(-90deg) translateY(-50%); opacity: 0; }
	to   { transform: perspective(800px) rotateX(0deg) translateY(0); opacity: 1; }
}
@keyframes pptx-tr-prism-out-to-bottom {
	from { transform: perspective(800px) rotateX(0deg) translateY(0); opacity: 1; }
	to   { transform: perspective(800px) rotateX(90deg) translateY(50%); opacity: 0; }
}

/* ── Reveal (slide away reveal) ──────────────────────────────────── */
@keyframes pptx-tr-reveal-out-to-right {
	from { transform: translateX(0); }
	to   { transform: translateX(100%); }
}
@keyframes pptx-tr-reveal-out-to-left {
	from { transform: translateX(0); }
	to   { transform: translateX(-100%); }
}
@keyframes pptx-tr-reveal-in {
	from { opacity: 0.5; }
	to   { opacity: 1; }
}

/* ── Ripple (expanding ring clip-path) ───────────────────────────── */
@keyframes pptx-tr-ripple-in {
	from { clip-path: circle(0% at 50% 50%); opacity: 0.5; }
	30%  { clip-path: circle(20% at 50% 50%); opacity: 0.7; }
	60%  { clip-path: circle(50% at 50% 50%); opacity: 0.9; }
	to   { clip-path: circle(75% at 50% 50%); opacity: 1; }
}

/* ── Shred (fragmented clip-path pieces) ─────────────────────────── */
@keyframes pptx-tr-shred-strips-in {
	from { clip-path: inset(0 100% 0 0); opacity: 0; }
	30%  { clip-path: inset(0 60% 0 0); opacity: 0.5; }
	to   { clip-path: inset(0); opacity: 1; }
}
@keyframes pptx-tr-shred-rectangles-in {
	from { clip-path: inset(50%); opacity: 0; }
	40%  { clip-path: inset(20%); opacity: 0.6; }
	to   { clip-path: inset(0); opacity: 1; }
}
@keyframes pptx-tr-shred-out {
	from { opacity: 1; }
	to   { opacity: 0; filter: blur(2px); }
}

/* ── Switch (flip/rotate swap) ───────────────────────────────────── */
@keyframes pptx-tr-switch-in-from-right {
	from { transform: perspective(800px) rotateY(-180deg); opacity: 0; }
	to   { transform: perspective(800px) rotateY(0deg); opacity: 1; }
}
@keyframes pptx-tr-switch-out-to-left {
	from { transform: perspective(800px) rotateY(0deg); opacity: 1; }
	to   { transform: perspective(800px) rotateY(180deg); opacity: 0; }
}
@keyframes pptx-tr-switch-in-from-left {
	from { transform: perspective(800px) rotateY(180deg); opacity: 0; }
	to   { transform: perspective(800px) rotateY(0deg); opacity: 1; }
}
@keyframes pptx-tr-switch-out-to-right {
	from { transform: perspective(800px) rotateY(0deg); opacity: 1; }
	to   { transform: perspective(800px) rotateY(-180deg); opacity: 0; }
}

/* ── Vortex (rotate + scale spiral) ──────────────────────────────── */
@keyframes pptx-tr-vortex-in {
	from { transform: rotate(720deg) scale(0); opacity: 0; }
	to   { transform: rotate(0deg) scale(1); opacity: 1; }
}
@keyframes pptx-tr-vortex-out {
	from { transform: rotate(0deg) scale(1); opacity: 1; }
	to   { transform: rotate(-720deg) scale(0); opacity: 0; }
}

/* ── Warp (skew distortion) ──────────────────────────────────────── */
@keyframes pptx-tr-warp-in {
	from { transform: scale(0.3) skewX(30deg) skewY(15deg); opacity: 0; }
	50%  { transform: scale(0.8) skewX(-5deg) skewY(-3deg); opacity: 0.7; }
	to   { transform: scale(1) skewX(0deg) skewY(0deg); opacity: 1; }
}
@keyframes pptx-tr-warp-out {
	from { transform: scale(1) skewX(0deg) skewY(0deg); opacity: 1; }
	50%  { transform: scale(0.8) skewX(5deg) skewY(3deg); opacity: 0.7; }
	to   { transform: scale(0.3) skewX(-30deg) skewY(-15deg); opacity: 0; }
}
@keyframes pptx-tr-warp-reverse-in {
	from { transform: scale(3) skewX(-20deg) skewY(-10deg); opacity: 0; filter: blur(4px); }
	to   { transform: scale(1) skewX(0deg) skewY(0deg); opacity: 1; filter: blur(0); }
}
@keyframes pptx-tr-warp-reverse-out {
	from { transform: scale(1) skewX(0deg) skewY(0deg); opacity: 1; filter: blur(0); }
	to   { transform: scale(3) skewX(20deg) skewY(10deg); opacity: 0; filter: blur(4px); }
}

/* ── WheelReverse (reverse wheel rotation) ───────────────────────── */
@keyframes pptx-tr-wheel-reverse-in {
	from { clip-path: circle(0% at 50% 50%); transform: rotate(180deg); }
	to   { clip-path: circle(75% at 50% 50%); transform: rotate(0deg); }
}

/* ── Window (scale from center with border) ──────────────────────── */
@keyframes pptx-tr-window-horz {
	from { clip-path: inset(0 50%); }
	to   { clip-path: inset(0 0); }
}
@keyframes pptx-tr-window-vert {
	from { clip-path: inset(50% 0); }
	to   { clip-path: inset(0 0); }
}
@keyframes pptx-tr-window-out {
	from { opacity: 1; transform: scale(1); }
	to   { opacity: 0; transform: scale(0.9); }
}
`;
