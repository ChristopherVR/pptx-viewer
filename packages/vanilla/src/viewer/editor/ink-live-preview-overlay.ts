import type { InkStrokeView } from 'pptx-viewer-shared';

import { buildStrokeSvg, createSvgEl } from '../render';

/**
 * The on-canvas live (in-progress) ink-stroke preview overlay for the Draw
 * tool: an SVG layer living INSIDE the scaled `.pptxv-stage` (raw, unscaled
 * slide-pixel coordinates, matching `motion-path-overlay.ts`'s own rationale
 * for living there), redrawn on every `DrawGestures` pointerdown/pointermove.
 *
 * Vanilla had no live stroke preview at all before this module: the other
 * four bindings show the in-progress path while the pointer is down (React's
 * `DrawingOverlaySvg`, Vue's `DrawingOverlay.vue`, Angular's
 * `InkDrawingService.liveInkPath`, Svelte's `InkDrawingOverlay.svelte`), but
 * vanilla's `editor-draw-gestures.ts` only ever committed the finished
 * stroke. This closes that gap using the shared `buildLiveInkStrokeView`
 * decision (plain path / pressure circles / tilt nib marks), the exact same
 * one a committed stroke gets from `buildInkGroupStrokes` (see `ink.ts`), via
 * `buildStrokeSvg`, the same per-stroke SVG builder `ink.ts` already uses.
 */
export interface InkLivePreviewOverlay {
	root: SVGSVGElement;
	/** Append to the scaled stage (or detach when there is nothing to draw). */
	mount(stage: HTMLElement | null): void;
	/** Redraw for the given view (or clear when `null`, i.e. idle / gesture ended). */
	update(view: InkStrokeView | null, canvasSize: { width: number; height: number }): void;
	destroy(): void;
}

export function createInkLivePreviewOverlay(doc: Document): InkLivePreviewOverlay {
	const root = createSvgEl(doc, 'svg', {
		'aria-hidden': 'true',
		'data-pptx-ink-live-preview': 'true',
	});
	root.style.position = 'absolute';
	root.style.left = '0';
	root.style.top = '0';
	root.style.pointerEvents = 'none';
	root.style.zIndex = '46';

	return {
		root,
		mount(stage) {
			if (!stage) {
				root.remove();
				return;
			}
			if (root.parentElement !== stage) {
				stage.appendChild(root);
			}
		},
		update(view, canvasSize) {
			if (!view) {
				root.replaceChildren();
				return;
			}
			const w = Math.max(canvasSize.width, 1);
			const h = Math.max(canvasSize.height, 1);
			root.setAttribute('width', String(w));
			root.setAttribute('height', String(h));
			root.setAttribute('viewBox', `0 0 ${w} ${h}`);
			root.replaceChildren(buildStrokeSvg(doc, view, undefined));
		},
		destroy() {
			root.remove();
		},
	};
}
