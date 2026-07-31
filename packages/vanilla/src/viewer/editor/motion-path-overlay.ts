import type { PptxElement } from 'pptx-viewer-core';
import type { MotionPathFrame } from 'pptx-viewer-shared';
import {
	isEditableMotionPath,
	motionPathEndPixel,
	motionPathToSvgD,
	setMotionPathEnd,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createSvgEl, setSvgAttrs } from '../render';

/** What the overlay draws: the selected element, its path, and the stage frame. */
export interface MotionPathOverlayState {
	/** Element the path is anchored to; its centre is the path origin. */
	element: PptxElement | null;
	/** OOXML path data (slide fractions, relative to the element centre). */
	path: string | undefined;
	/** Stage size in slide pixels: the unit the path fractions scale by. */
	canvasSize: { width: number; height: number };
	/** Editor zoom, so a pointer delta converts back to slide pixels. */
	scale: number;
	/** Whether the end handle can be dragged. */
	canEdit: boolean;
}

export interface MotionPathOverlay {
	root: SVGSVGElement;
	/** Append to the scaled stage (or detach when there is nothing to draw). */
	mount(stage: HTMLElement | null): void;
	update(state: MotionPathOverlayState): void;
	destroy(): void;
}

/** In-flight end-handle drag: the path the gesture started from plus its anchor. */
interface DragSession {
	pointerId: number;
	startClientX: number;
	startClientY: number;
	basePath: string;
	frame: MotionPathFrame;
	scale: number;
	draft: string;
}

const STROKE = '#0ea5e9';

/**
 * Draws the selected element's motion path on the stage and lets the user drag
 * its end point.
 *
 * WHY this lives INSIDE the scaled stage rather than beside it like the
 * selection overlay: a motion path is authored in slide fractions measured from
 * the element centre, so drawing it in the stage's own unscaled slide-pixel
 * space means no zoom maths at all beyond converting the pointer delta back by
 * `scale`. It is still a stage-level sibling of the elements (never a child of
 * one) because a path routinely extends far outside the shape's box, and the
 * element wrapper carries the shape's rotation / flip transform, which would
 * skew the path.
 *
 * WHY the drag is committed once on release instead of per pointer-move: this
 * binding re-renders the whole stage on every slide mutation, so a per-move
 * commit would both rebuild the canvas at pointer frequency and leave one undo
 * step per pixel dragged. The overlay therefore redraws itself from a local
 * draft while the gesture runs and hands the final path over on release, which
 * costs nothing visually (the shape itself does not move during a path drag).
 */
export function createMotionPathOverlay(
	doc: Document,
	t: Translator,
	onChangePath: (path: string) => void,
): MotionPathOverlay {
	const root = createSvgEl(doc, 'svg', {
		role: 'img',
		'aria-label': t('pptx.animation.motionPath.overlay'),
		'data-pptx-motion-path-overlay': 'true',
	});
	root.style.position = 'absolute';
	root.style.left = '0';
	root.style.top = '0';
	root.style.zIndex = '45';
	root.style.pointerEvents = 'none';

	const track = createSvgEl(doc, 'path', {
		fill: 'none',
		stroke: STROKE,
		'stroke-width': 2,
		'stroke-dasharray': '6 4',
		'vector-effect': 'non-scaling-stroke',
	});
	const start = createSvgEl(doc, 'circle', { r: 5, fill: STROKE, opacity: 0.55 });
	const end = createSvgEl(doc, 'circle', {
		r: 7,
		fill: '#ffffff',
		stroke: STROKE,
		'stroke-width': 2,
		'aria-label': t('pptx.animation.motionPath.endHandle'),
		'data-pptx-motion-path-handle': 'end',
	});
	root.append(track, start, end);

	let current: MotionPathOverlayState | null = null;
	let drag: DragSession | null = null;

	const frameFor = (element: PptxElement, state: MotionPathOverlayState): MotionPathFrame => ({
		originX: element.x + element.width / 2,
		originY: element.y + element.height / 2,
		slideWidth: state.canvasSize.width,
		slideHeight: state.canvasSize.height,
	});

	/** Repaint the track + handles for `path` against `frame`. */
	const draw = (path: string, frame: MotionPathFrame, editable: boolean): void => {
		const d = motionPathToSvgD(path, frame);
		const tip = motionPathEndPixel(path, frame);
		setSvgAttrs(track, { d });
		setSvgAttrs(start, { cx: frame.originX, cy: frame.originY });
		setSvgAttrs(end, { cx: tip.x, cy: tip.y });
		end.style.pointerEvents = editable ? 'auto' : 'none';
		end.style.cursor = editable ? 'move' : '';
	};

	const finishDrag = (): void => {
		const session = drag;
		drag = null;
		doc.defaultView?.removeEventListener('pointermove', onPointerMove);
		doc.defaultView?.removeEventListener('pointerup', onPointerUp);
		doc.defaultView?.removeEventListener('pointercancel', onPointerUp);
		if (session && session.draft !== session.basePath) {
			onChangePath(session.draft);
		}
	};

	function onPointerMove(event: PointerEvent): void {
		if (!drag || event.pointerId !== drag.pointerId) {
			return;
		}
		const scale = drag.scale || 1;
		const dxPx = (event.clientX - drag.startClientX) / scale;
		const dyPx = (event.clientY - drag.startClientY) / scale;
		const base = motionPathEndPixel(drag.basePath, drag.frame);
		const nextX = (base.x + dxPx - drag.frame.originX) / drag.frame.slideWidth;
		const nextY = (base.y + dyPx - drag.frame.originY) / drag.frame.slideHeight;
		drag.draft = setMotionPathEnd(drag.basePath, nextX, nextY);
		draw(drag.draft, drag.frame, true);
	}

	function onPointerUp(event: PointerEvent): void {
		if (drag && event.pointerId === drag.pointerId) {
			finishDrag();
		}
	}

	end.addEventListener('pointerdown', (event: PointerEvent) => {
		const element = current?.element;
		const path = current?.path;
		if (!element || !path || !current?.canEdit || !isEditableMotionPath(path)) {
			return;
		}
		// The stage's own pointerdown starts a marquee / deselect gesture, so the
		// handle has to claim the event before it reaches the canvas.
		event.stopPropagation();
		event.preventDefault();
		drag = {
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			basePath: path,
			frame: frameFor(element, current),
			scale: current.scale,
			draft: path,
		};
		doc.defaultView?.addEventListener('pointermove', onPointerMove);
		doc.defaultView?.addEventListener('pointerup', onPointerUp);
		doc.defaultView?.addEventListener('pointercancel', onPointerUp);
	});

	return {
		root,
		mount(stage) {
			if (!current?.element || !current.path) {
				root.remove();
				return;
			}
			if (stage && root.parentElement !== stage) {
				stage.appendChild(root);
			} else if (!stage) {
				root.remove();
			}
		},
		update(state) {
			current = state;
			const { element, path } = state;
			if (!element || !path) {
				root.remove();
				return;
			}
			// A live drag owns the geometry until it is released; re-applying the
			// committed state mid-gesture would snap the handle back under the
			// pointer on every unrelated store notification.
			if (drag) {
				return;
			}
			setSvgAttrs(root, { width: state.canvasSize.width, height: state.canvasSize.height });
			draw(path, frameFor(element, state), state.canEdit && isEditableMotionPath(path));
		},
		destroy() {
			finishDrag();
			root.remove();
		},
	};
}
