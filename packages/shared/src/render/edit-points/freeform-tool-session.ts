/**
 * `FreeformToolSession`: the click-to-place drawing gesture of the Freeform:
 * Shape and Curve tools as a framework-free state machine. A binding shows a
 * transparent capture layer over the slide while the tool is armed, forwards
 * pointer / double-click / key events in SLIDE pixels, draws `view()`, and
 * inserts the element handed to `onCommit`.
 *
 * Gestures (matching PowerPoint):
 *  - click to place a point (Freeform: a corner; Curve: a smooth point);
 *  - Freeform only: press and drag to draw a freehand run;
 *  - click the start point to close the shape and finish;
 *  - double-click or Enter to finish an open shape;
 *  - Escape finishes what has been drawn (or cancels a lone point);
 *  - Backspace removes the last placed point.
 *
 * @module render/edit-points/freeform-tool-session
 */
import type { ShapePptxElement } from 'pptx-viewer-core';

import type { EditFrame } from './edit-points-types';
import { editGeometryToSlidePath } from './edit-points-view';
import type { FreeformToolKind, FreeformToolVertex } from './freeform-tool-geometry';
import { buildFreeformToolElement, buildFreeformToolGeometry } from './freeform-tool-geometry';

export interface FreeformToolSessionOptions {
	tool: FreeformToolKind;
	/** Insert the finished shape. */
	onCommit: (element: ShapePptxElement) => void;
	/** The gesture ended without a shape (and the tool should disarm). */
	onCancel: () => void;
	/** The preview changed; re-render. */
	onChange?: () => void;
}

/** What a binding draws while a drawing tool is armed. */
export interface FreeformToolView {
	/** The outline so far, including the rubber band to the pointer. */
	previewD: string;
	strokeWidth: number;
	/** The start-point marker (click it to close), once there is a start. */
	start: { x: number; y: number; size: number; armed: boolean } | null;
}

/** Screen distance (CSS px at 100%) from the start that counts as "on it". */
const CLOSE_RADIUS_PX = 8;
/** Pointer travel (CSS px at 100%) that turns a press into a freehand drag. */
const FREEHAND_START_PX = 3;
/** Minimum spacing between freehand samples (CSS px at 100%). */
const FREEHAND_SAMPLE_PX = 2;

const SLIDE_FRAME: EditFrame = {
	x: 0,
	y: 0,
	width: 0,
	height: 0,
	rotation: 0,
	flipH: false,
	flipV: false,
};

export class FreeformToolSession {
	private vertices: FreeformToolVertex[] = [];
	private hover: FreeformToolVertex | null = null;
	private press: { x: number; y: number; freehand: boolean } | null = null;
	private ended = false;
	private scale = 1;

	constructor(private readonly options: FreeformToolSessionOptions) {}

	get tool(): FreeformToolKind {
		return this.options.tool;
	}

	get isEnded(): boolean {
		return this.ended;
	}

	/** Placed points so far (slide px). */
	get points(): readonly FreeformToolVertex[] {
		return this.vertices;
	}

	/** Tell the session the editor zoom, so hit radii stay constant on screen. */
	setScale(scale: number): void {
		this.scale = scale > 0 ? scale : 1;
	}

	private px(value: number): number {
		return value / this.scale;
	}

	private nearStart(p: { x: number; y: number }): boolean {
		const first = this.vertices[0];
		return (
			this.vertices.length >= 3 &&
			Boolean(first) &&
			Math.hypot(p.x - first.x, p.y - first.y) <= this.px(CLOSE_RADIUS_PX)
		);
	}

	private changed(): void {
		this.options.onChange?.();
	}

	pointerDown(p: { x: number; y: number; button?: number }): void {
		if (this.ended || (p.button ?? 0) !== 0) {
			return;
		}
		if (this.nearStart(p)) {
			this.finish(true);
			return;
		}
		this.vertices.push({ x: p.x, y: p.y });
		this.press = { x: p.x, y: p.y, freehand: false };
		this.changed();
	}

	pointerMove(p: { x: number; y: number }): void {
		if (this.ended) {
			return;
		}
		const press = this.press;
		if (press && this.options.tool === 'freeformShape') {
			if (
				!press.freehand &&
				Math.hypot(p.x - press.x, p.y - press.y) >= this.px(FREEHAND_START_PX)
			) {
				press.freehand = true;
			}
			const last = this.vertices[this.vertices.length - 1];
			if (press.freehand && Math.hypot(p.x - last.x, p.y - last.y) >= this.px(FREEHAND_SAMPLE_PX)) {
				this.vertices.push({ x: p.x, y: p.y, freehand: true });
			}
		}
		this.hover = { x: p.x, y: p.y };
		this.changed();
	}

	pointerUp(): void {
		if (this.press?.freehand) {
			// The end of a freehand run is where the next straight edge starts:
			// make it a real corner so simplification never drops it.
			const last = this.vertices[this.vertices.length - 1];
			if (last) {
				last.freehand = false;
			}
		}
		this.press = null;
	}

	/** Double-click: finish the open shape. */
	doubleClick(): void {
		this.finish(false);
	}

	/** Returns whether the key was consumed. */
	keyDown(key: string): boolean {
		if (this.ended) {
			return false;
		}
		if (key === 'Enter' || key === 'Escape') {
			this.finish(false);
			return true;
		}
		if (key === 'Backspace' && this.vertices.length > 0) {
			this.vertices.pop();
			this.changed();
			return true;
		}
		return false;
	}

	/** End the gesture: insert the shape, or cancel when there is none. */
	finish(closed: boolean): void {
		if (this.ended) {
			return;
		}
		this.ended = true;
		this.press = null;
		const element = buildFreeformToolElement(this.options.tool, this.vertices, closed);
		if (element) {
			this.options.onCommit(element);
		} else {
			this.options.onCancel();
		}
	}

	/** Abandon the gesture without inserting anything. */
	cancel(): void {
		if (!this.ended) {
			this.ended = true;
			this.options.onCancel();
		}
	}

	view(): FreeformToolView {
		const hover = this.hover && !this.press?.freehand ? [this.hover] : [];
		const armed = this.hover ? this.nearStart(this.hover) : false;
		const geometry = buildFreeformToolGeometry(
			this.options.tool,
			[...this.vertices, ...(armed ? [] : hover)],
			armed,
		);
		const first = this.vertices[0];
		return {
			previewD: geometry ? editGeometryToSlidePath(SLIDE_FRAME, geometry) : '',
			strokeWidth: this.px(1.5),
			start: first ? { x: first.x, y: first.y, size: this.px(CLOSE_RADIUS_PX), armed } : null,
		};
	}
}
