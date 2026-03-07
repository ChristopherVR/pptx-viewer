/**
 * CSS @keyframes for Office 2010 (p14 namespace) slide transitions.
 *
 * Complements the core keyframes in `slide-transitions.ts` with the 18
 * additional transition effects introduced in PowerPoint 2010.
 */

export const P14_TRANSITION_KEYFRAMES = `
/* ── Conveyor (translate X with staggered timing) ──────────────────── */
@keyframes pptx-tr-conveyor-in-from-right {
	from { transform: translateX(100%) rotateY(-30deg); }
	60%  { transform: translateX(20%) rotateY(-10deg); }
	to   { transform: translateX(0) rotateY(0deg); }
}
@keyframes pptx-tr-conveyor-out-to-left {
	from { transform: translateX(0) rotateY(0deg); }
	40%  { transform: translateX(-20%) rotateY(10deg); }
	to   { transform: translateX(-100%) rotateY(30deg); }
}
@keyframes pptx-tr-conveyor-in-from-left {
	from { transform: translateX(-100%) rotateY(30deg); }
	60%  { transform: translateX(-20%) rotateY(10deg); }
	to   { transform: translateX(0) rotateY(0deg); }
}
@keyframes pptx-tr-conveyor-out-to-right {
	from { transform: translateX(0) rotateY(0deg); }
	40%  { transform: translateX(20%) rotateY(-10deg); }
	to   { transform: translateX(100%) rotateY(-30deg); }
}

/* ── Doors (clip-path from center split) ──────────────────────────── */
@keyframes pptx-tr-doors-horz {
	from { clip-path: inset(0 50%); }
	to   { clip-path: inset(0 0); }
}
@keyframes pptx-tr-doors-vert {
	from { clip-path: inset(50% 0); }
	to   { clip-path: inset(0 0); }
}

/* ── Ferris (rotate elements around center) ───────────────────────── */
@keyframes pptx-tr-ferris-in-from-right {
	from { transform: translateX(80%) rotate(45deg) scale(0.6); opacity: 0; }
	to   { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; }
}
@keyframes pptx-tr-ferris-out-to-left {
	from { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; }
	to   { transform: translateX(-80%) rotate(-45deg) scale(0.6); opacity: 0; }
}
@keyframes pptx-tr-ferris-in-from-left {
	from { transform: translateX(-80%) rotate(-45deg) scale(0.6); opacity: 0; }
	to   { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; }
}
@keyframes pptx-tr-ferris-out-to-right {
	from { transform: translateX(0) rotate(0deg) scale(1); opacity: 1; }
	to   { transform: translateX(80%) rotate(45deg) scale(0.6); opacity: 0; }
}

/* ── Flash (bright flash opacity burst) ──────────────────────────── */
@keyframes pptx-tr-flash-white {
	0%   { opacity: 1; }
	30%  { opacity: 0; }
	50%  { opacity: 0; }
	100% { opacity: 1; }
}
@keyframes pptx-tr-flash-in {
	0%   { opacity: 0; }
	50%  { opacity: 0; }
	70%  { opacity: 1; }
	100% { opacity: 1; }
}

/* ── Flythrough (scale + translate Z-axis feel) ──────────────────── */
@keyframes pptx-tr-flythrough-in {
	from { transform: scale(4) translateZ(200px); opacity: 0; filter: blur(8px); }
	to   { transform: scale(1) translateZ(0); opacity: 1; filter: blur(0); }
}
@keyframes pptx-tr-flythrough-out {
	from { transform: scale(1) translateZ(0); opacity: 1; filter: blur(0); }
	to   { transform: scale(0.1) translateZ(-200px); opacity: 0; filter: blur(8px); }
}
@keyframes pptx-tr-flythrough-reverse-in {
	from { transform: scale(0.1) translateZ(-200px); opacity: 0; filter: blur(8px); }
	to   { transform: scale(1) translateZ(0); opacity: 1; filter: blur(0); }
}
@keyframes pptx-tr-flythrough-reverse-out {
	from { transform: scale(1) translateZ(0); opacity: 1; filter: blur(0); }
	to   { transform: scale(4) translateZ(200px); opacity: 0; filter: blur(8px); }
}

/* ── Gallery (translate with perspective) ─────────────────────────── */
@keyframes pptx-tr-gallery-in-from-right {
	from { transform: perspective(800px) translateX(100%) rotateY(-45deg); opacity: 0.5; }
	to   { transform: perspective(800px) translateX(0) rotateY(0deg); opacity: 1; }
}
@keyframes pptx-tr-gallery-out-to-left {
	from { transform: perspective(800px) translateX(0) rotateY(0deg); opacity: 1; }
	to   { transform: perspective(800px) translateX(-100%) rotateY(45deg); opacity: 0.5; }
}
@keyframes pptx-tr-gallery-in-from-left {
	from { transform: perspective(800px) translateX(-100%) rotateY(45deg); opacity: 0.5; }
	to   { transform: perspective(800px) translateX(0) rotateY(0deg); opacity: 1; }
}
@keyframes pptx-tr-gallery-out-to-right {
	from { transform: perspective(800px) translateX(0) rotateY(0deg); opacity: 1; }
	to   { transform: perspective(800px) translateX(100%) rotateY(-45deg); opacity: 0.5; }
}

/* ── Glitter (particle dissolve effect) ──────────────────────────── */
@keyframes pptx-tr-glitter-in {
	from { opacity: 0; filter: brightness(1.5) contrast(1.3) blur(2px); }
	60%  { opacity: 0.7; filter: brightness(1.2) contrast(1.1) blur(1px); }
	to   { opacity: 1; filter: brightness(1) contrast(1) blur(0); }
}

/* ── Honeycomb (hexagonal reveal) ────────────────────────────────── */
@keyframes pptx-tr-honeycomb-in {
	from {
		clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%);
		opacity: 0;
	}
	to {
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		opacity: 1;
	}
}
@keyframes pptx-tr-honeycomb-out {
	from { opacity: 1; }
	to   { opacity: 0; filter: blur(2px); }
}

/* ── Pan (large-scale translate) ─────────────────────────────────── */
@keyframes pptx-tr-pan-from-right {
	from { transform: translateX(100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-pan-to-left {
	from { transform: translateX(0); }
	to   { transform: translateX(-100%); }
}
@keyframes pptx-tr-pan-from-left {
	from { transform: translateX(-100%); }
	to   { transform: translateX(0); }
}
@keyframes pptx-tr-pan-to-right {
	from { transform: translateX(0); }
	to   { transform: translateX(100%); }
}
@keyframes pptx-tr-pan-from-bottom {
	from { transform: translateY(100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-pan-to-top {
	from { transform: translateY(0); }
	to   { transform: translateY(-100%); }
}
@keyframes pptx-tr-pan-from-top {
	from { transform: translateY(-100%); }
	to   { transform: translateY(0); }
}
@keyframes pptx-tr-pan-to-bottom {
	from { transform: translateY(0); }
	to   { transform: translateY(100%); }
}
`;
