import type { CanvasSize, RulerUnit } from 'pptx-viewer-shared';
import {
	generateTicks,
	RULER_FONT_SIZE,
	RULER_THICKNESS,
	rulerDragToGuidePosition,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl, setSvgAttrs } from '../render';

/**
 * The View > Rulers strips: a horizontal ruler along the top of the slide, a
 * vertical one down the left, and the corner square where they meet.
 *
 * Drawn as SIBLINGS of the scaled stage (inside `.pptxv-stage-wrap`, in the
 * gutter the `pptxv-showRulers` rule opens up around it) rather than inside it,
 * because the stage carries a CSS `transform: scale()`: a ruler inside it would
 * have its tick strokes and labels scaled by the zoom instead of tracking it.
 * The strips therefore receive the scale and lay their ticks out in
 * already-scaled screen px.
 *
 * Tick geometry comes from the shared `generateTicks` and a drag off a strip is
 * resolved by the shared `rulerDragToGuidePosition`, so this binding agrees
 * with React, Vue, Angular and Svelte on unit, subdivision density, label
 * thinning and the guide-drop rules. Vanilla previously faked the whole feature
 * with a flat 18px border on the stage wrap: no ticks, no labels, no guides.
 */

/** Selected element extent (unscaled slide px) shaded on both strips. */
export interface RulerSelection {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface RulerStripsState {
	/** View > Rulers, minus presentation mode (rulers are an editing aid). */
	visible: boolean;
	canvasSize: CanvasSize;
	/** Effective stage scale (fit * zoom). */
	scale: number;
	unit: RulerUnit;
	selection: RulerSelection | null;
	/** Offer the drag-out-a-guide gesture (editable canvases only). */
	draggable: boolean;
}

export interface RulerStrips {
	/**
	 * Attach the strips to the stage wrap. Re-callable: the wrap's children are
	 * replaced on every stage render, so the strips must be re-appended after it.
	 */
	mount(stageWrap: HTMLElement): void;
	/** Repaint from the current state (hides the strips when not visible). */
	update(state: RulerStripsState): void;
	destroy(): void;
}

const T = RULER_THICKNESS;
const FS = RULER_FONT_SIZE;

export function createRulerStrips(
	doc: Document,
	onCreateGuide: (axis: 'h' | 'v', position: number) => void,
): RulerStrips {
	const corner = createEl(doc, 'div', 'pptxv-ruler-corner');
	corner.setAttribute('aria-hidden', 'true');
	const hStrip = createSvgEl(doc, 'svg', { class: 'pptxv-ruler pptxv-ruler-h' });
	hStrip.setAttribute('data-pptx-ruler', 'h');
	hStrip.setAttribute('role', 'presentation');
	const vStrip = createSvgEl(doc, 'svg', { class: 'pptxv-ruler pptxv-ruler-v' });
	vStrip.setAttribute('data-pptx-ruler', 'v');
	vStrip.setAttribute('role', 'presentation');

	let draggable = false;
	let scale = 1;
	let canvasSize: CanvasSize = { width: 0, height: 0 };
	// The guide is created on pointer-UP, never pointer-down, so a stray click on
	// a strip cannot drop a guide the user never dragged out.
	let dragAxis: 'h' | 'v' | null = null;

	const startDrag = (axis: 'h' | 'v', event: PointerEvent): void => {
		if (!draggable) {
			return;
		}
		// The stage wrap owns marquee/selection gestures; a ruler drag is not one.
		event.stopPropagation();
		event.preventDefault();
		(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		dragAxis = axis;
	};

	const endDrag = (axis: 'h' | 'v', event: PointerEvent): void => {
		const armed = dragAxis;
		dragAxis = null;
		const strip = event.currentTarget as Element | null;
		if (armed !== axis || !draggable || !strip) {
			return;
		}
		try {
			strip.releasePointerCapture?.(event.pointerId);
		} catch {
			// Capture may already have been released by the browser.
		}
		const rect = strip.getBoundingClientRect();
		const offset = axis === 'h' ? event.clientY - rect.top : event.clientX - rect.left;
		const position = rulerDragToGuidePosition(
			offset,
			scale,
			axis === 'h' ? canvasSize.height : canvasSize.width,
		);
		if (position !== null) {
			onCreateGuide(axis, position);
		}
	};

	hStrip.addEventListener('pointerdown', (event) => startDrag('h', event as PointerEvent));
	hStrip.addEventListener('pointerup', (event) => endDrag('h', event as PointerEvent));
	vStrip.addEventListener('pointerdown', (event) => startDrag('v', event as PointerEvent));
	vStrip.addEventListener('pointerup', (event) => endDrag('v', event as PointerEvent));

	/** Repaint one strip: background, selection highlight, ticks and labels. */
	const paint = (
		strip: SVGSVGElement,
		axis: 'h' | 'v',
		lengthPx: number,
		state: RulerStripsState,
	): void => {
		const scaled = lengthPx * state.scale;
		const horizontal = axis === 'h';
		setSvgAttrs(strip, {
			width: horizontal ? scaled : T,
			height: horizontal ? T : scaled,
		});
		strip.replaceChildren();
		strip.appendChild(
			createSvgEl(doc, 'rect', {
				class: 'pptxv-ruler-bg',
				width: horizontal ? scaled : T,
				height: horizontal ? T : scaled,
			}),
		);
		const selection = state.selection;
		if (selection) {
			const start = (horizontal ? selection.x : selection.y) * state.scale;
			const span = Math.max((horizontal ? selection.width : selection.height) * state.scale, 1);
			strip.appendChild(
				createSvgEl(doc, 'rect', {
					class: 'pptxv-ruler-highlight',
					x: horizontal ? start : 0,
					y: horizontal ? 0 : start,
					width: horizontal ? span : T,
					height: horizontal ? T : span,
				}),
			);
		}
		for (const tick of generateTicks(lengthPx, state.scale, state.unit)) {
			const depth = T - T * (tick.isMajor ? 0.6 : 0.3);
			strip.appendChild(
				createSvgEl(doc, 'line', {
					class: 'pptxv-ruler-tick',
					x1: horizontal ? tick.position : T,
					y1: horizontal ? T : tick.position,
					x2: horizontal ? tick.position : depth,
					y2: horizontal ? depth : tick.position,
					'stroke-width': tick.isMajor ? 1 : 0.5,
				}),
			);
			if (!tick.label) {
				continue;
			}
			const label = createSvgEl(doc, 'text', {
				class: 'pptxv-ruler-label',
				x: horizontal ? tick.position + 2 : 2,
				y: horizontal ? FS + 1 : tick.position + FS + 2,
				'font-size': FS,
			});
			label.textContent = tick.label;
			strip.appendChild(label);
		}
		strip.appendChild(
			createSvgEl(doc, 'line', {
				class: 'pptxv-ruler-edge',
				x1: horizontal ? 0 : T - 0.5,
				y1: horizontal ? T - 0.5 : 0,
				x2: horizontal ? scaled : T - 0.5,
				y2: horizontal ? T - 0.5 : scaled,
			}),
		);
	};

	return {
		mount(stageWrap) {
			if (corner.parentNode !== stageWrap) {
				stageWrap.append(corner, hStrip, vStrip);
			}
		},
		update(state) {
			draggable = state.draggable;
			scale = state.scale;
			canvasSize = state.canvasSize;
			corner.hidden = !state.visible;
			hStrip.style.display = state.visible ? '' : 'none';
			vStrip.style.display = state.visible ? '' : 'none';
			hStrip.classList.toggle('is-draggable', state.draggable);
			vStrip.classList.toggle('is-draggable', state.draggable);
			if (!state.visible) {
				return;
			}
			paint(hStrip, 'h', state.canvasSize.width, state);
			paint(vStrip, 'v', state.canvasSize.height, state);
		},
		destroy() {
			corner.remove();
			hStrip.remove();
			vStrip.remove();
		},
	};
}
