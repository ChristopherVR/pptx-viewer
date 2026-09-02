/**
 * Wipe mask keyframes for the slide-transition overlay.
 *
 * PowerPoint feathers the wipe edge with a WIDE, smooth gradient - the fade
 * zone spans roughly a slide width in real renders, not a narrow band. The
 * incoming layer is masked with a 3x-oversized gradient (fade zone = one slide
 * width) whose position sweeps it across the slide; the band fully exits both
 * edges, so the start is fully hidden and the end fully opaque. The old
 * clip-path inset reveal had a hard edge no feather could be applied to.
 *
 * Extracted from `slide-transition-keyframes` to keep that module at its
 * original size; `SLIDE_TRANSITION_KEYFRAMES` concatenates this block.
 *
 * @module render/slide-transition-wipe-keyframes
 */

/**
 * The four directional wipe reveals (`pptx-tr-wipe-from-*`), as a stylesheet
 * fragment.
 */
export const WIPE_MASK_KEYFRAMES = `
/* ── Wipe (soft mask reveal) ──────────────────────────────────────────── */
/* PowerPoint feathers the wipe edge with a WIDE, smooth gradient - the fade
 * zone spans roughly a slide width in real renders, not a narrow band. The
 * incoming layer is masked with a 3x-oversized gradient (fade zone = one slide
 * width) whose position sweeps it across the slide; the band fully exits both
 * edges, so the start is fully hidden and the end fully opaque. */
@keyframes pptx-tr-wipe-from-left {
	from {
		-webkit-mask-image: linear-gradient(to right, #000 33.3%, transparent 66.7%);
		-webkit-mask-size: 300% 100%;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: 100% 0;
		mask-image: linear-gradient(to right, #000 33.3%, transparent 66.7%);
		mask-size: 300% 100%;
		mask-repeat: no-repeat;
		mask-position: 100% 0;
	}
	to {
		-webkit-mask-image: linear-gradient(to right, #000 33.3%, transparent 66.7%);
		-webkit-mask-size: 300% 100%;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: 0% 0;
		mask-image: linear-gradient(to right, #000 33.3%, transparent 66.7%);
		mask-size: 300% 100%;
		mask-repeat: no-repeat;
		mask-position: 0% 0;
	}
}
@keyframes pptx-tr-wipe-from-right {
	from {
		-webkit-mask-image: linear-gradient(to left, #000 33.3%, transparent 66.7%);
		-webkit-mask-size: 300% 100%;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: 0% 0;
		mask-image: linear-gradient(to left, #000 33.3%, transparent 66.7%);
		mask-size: 300% 100%;
		mask-repeat: no-repeat;
		mask-position: 0% 0;
	}
	to {
		-webkit-mask-image: linear-gradient(to left, #000 33.3%, transparent 66.7%);
		-webkit-mask-size: 300% 100%;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: 100% 0;
		mask-image: linear-gradient(to left, #000 33.3%, transparent 66.7%);
		mask-size: 300% 100%;
		mask-repeat: no-repeat;
		mask-position: 100% 0;
	}
}
@keyframes pptx-tr-wipe-from-top {
	from {
		-webkit-mask-image: linear-gradient(to bottom, #000 33.3%, transparent 66.7%);
		-webkit-mask-size: 100% 300%;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: 0 100%;
		mask-image: linear-gradient(to bottom, #000 33.3%, transparent 66.7%);
		mask-size: 100% 300%;
		mask-repeat: no-repeat;
		mask-position: 0 100%;
	}
	to {
		-webkit-mask-image: linear-gradient(to bottom, #000 33.3%, transparent 66.7%);
		-webkit-mask-size: 100% 300%;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: 0 0%;
		mask-image: linear-gradient(to bottom, #000 33.3%, transparent 66.7%);
		mask-size: 100% 300%;
		mask-repeat: no-repeat;
		mask-position: 0 0%;
	}
}
@keyframes pptx-tr-wipe-from-bottom {
	from {
		-webkit-mask-image: linear-gradient(to top, #000 33.3%, transparent 66.7%);
		-webkit-mask-size: 100% 300%;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: 0 0%;
		mask-image: linear-gradient(to top, #000 33.3%, transparent 66.7%);
		mask-size: 100% 300%;
		mask-repeat: no-repeat;
		mask-position: 0 0%;
	}
	to {
		-webkit-mask-image: linear-gradient(to top, #000 33.3%, transparent 66.7%);
		-webkit-mask-size: 100% 300%;
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: 0 100%;
		mask-image: linear-gradient(to top, #000 33.3%, transparent 66.7%);
		mask-size: 100% 300%;
		mask-repeat: no-repeat;
		mask-position: 0 100%;
	}
}
`;
