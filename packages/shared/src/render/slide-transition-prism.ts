/**
 * `slide-transition-prism`: the `p:prism` (Office generic 3-D perspective
 * rotation) slide-transition `@keyframes`, split out of `p14-transition-keyframes`
 * to keep that module under the project's per-file LOC budget. Not COM-remeasured
 * in this pass; carried over unchanged from `p14-transition-keyframes`.
 *
 * @module render/slide-transition-prism
 */

/** `@keyframes` for all four Prism directions. Folded into `P14_TRANSITION_KEYFRAMES_2`. */
export const PRISM_TRANSITION_KEYFRAMES = `
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
`;
