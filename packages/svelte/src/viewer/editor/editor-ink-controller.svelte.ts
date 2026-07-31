import type { InkPoint } from 'pptx-viewer-shared';
import { pointsToSvgPathD, strokeToInkElement } from 'pptx-viewer-shared';

import { strokeToFreeformShape } from './editor-freeform';
import { removeElement } from './editor-mutations';
import type { EditorState } from './editor-state.svelte';

/**
 * The ribbon Draw tab's active tool. `'select'` means "not drawing": the
 * stage's normal selection/drag/resize gestures own the pointer, matching
 * React's `DrawingTool` / Angular's `DrawTool`.
 *
 * `freeform` shares the pen's gesture but commits a closed custom-geometry
 * SHAPE rather than an ink stroke, so the result is editable/fillable like any
 * other shape; see `editor-freeform.ts`.
 */
export type InkDrawTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform';

const DEFAULT_INK_COLOR = '#000000';
const DEFAULT_INK_WIDTH = 3;

/** Bounding-box hit-test radius (element px) for the eraser tool; mirrors the React/Angular drawing overlays. */
const ERASER_HIT_RADIUS = 15;

/**
 * EditorInkController: the ribbon Draw tab's tool/colour/width state plus the
 * pure element-factory / erase mutations, split out of `EditorState` to keep
 * it under the repo's 300-LOC budget (mirrors `EditorArrangeController` /
 * `EditorBackgroundController`). Instantiated as `EditorState.inkOps`.
 *
 * The actual pointer-event lifecycle (accumulating a stroke's points, driving
 * the live preview) lives in `editor-ink-gesture.ts`, owned by
 * `EditorController`; this class only holds the tool/colour/width state the
 * gesture controller reads and the two mutations it calls into
 * ({@link commitStroke}, {@link eraseElementAt}), both of which route through
 * `EditorState` so they participate in undo/redo like every other edit.
 */
export class EditorInkController {
	readonly #editor: EditorState;

	/** The active draw tool. `'select'` hands the stage back to normal editing gestures. */
	tool = $state<InkDrawTool>('select');
	/** Stroke colour for new pen/highlighter strokes. */
	color = $state(DEFAULT_INK_COLOR);
	/** Stroke width (px, element space) for new pen/highlighter strokes. */
	width = $state(DEFAULT_INK_WIDTH);
	/** SVG path `d` for the in-progress stroke's live preview, or `''` when idle. */
	livePathD = $state('');

	constructor(editor: EditorState) {
		this.#editor = editor;
	}

	/** True whenever a tool other than `select` is active: the stage hands pointer gestures to ink drawing. */
	get isDrawing(): boolean {
		return this.tool !== 'select';
	}

	/**
	 * Switch the active tool. Clears the current selection when entering a draw
	 * tool so the selection overlay's resize/rotate handles (which own their
	 * own `pointerdown` and would otherwise race a drawing gesture over the
	 * same screen area) are not rendered while drawing.
	 */
	setTool(tool: InkDrawTool): void {
		this.tool = tool;
		this.livePathD = '';
		if (tool !== 'select') {
			this.#editor.select(null);
		}
	}

	setColor(color: string): void {
		this.color = color;
	}

	setWidth(width: number): void {
		this.width = width;
	}

	/** Update the live preview path while a pen/highlighter stroke is in progress. */
	previewStroke(points: readonly InkPoint[]): void {
		this.livePathD = pointsToSvgPathD([...points]);
	}

	/**
	 * Finalise the in-progress stroke (undoable via `EditorState.insertElement`),
	 * or discard it silently when too short (a plain tap) or the tool changed
	 * mid-gesture. Pen/highlighter commit an `ink` element; freeform commits a
	 * closed custom-geometry `shape`.
	 */
	commitStroke(points: readonly InkPoint[]): void {
		this.livePathD = '';
		if (this.tool === 'freeform') {
			const shape = strokeToFreeformShape(points, this.color, this.width);
			if (shape) {
				this.#editor.insertElement(shape);
			}
			return;
		}
		if (this.tool !== 'pen' && this.tool !== 'highlighter') {
			return;
		}
		const ink = strokeToInkElement({
			points: [...points],
			color: this.color,
			width: this.width,
			tool: this.tool,
		});
		if (ink) {
			this.#editor.insertElement(ink);
		}
	}

	/**
	 * Hit-test `ink` elements on the current slide at `point` (topmost first)
	 * and delete the first match, with history. No-op when nothing is hit.
	 */
	eraseElementAt(point: InkPoint): void {
		const current = this.#editor.currentSlideIndex;
		const elements = this.#editor.slides[current]?.elements ?? [];
		for (let i = elements.length - 1; i >= 0; i--) {
			const el = elements[i];
			if (el.type !== 'ink') {
				continue;
			}
			if (
				point.x >= el.x - ERASER_HIT_RADIUS &&
				point.x <= el.x + el.width + ERASER_HIT_RADIUS &&
				point.y >= el.y - ERASER_HIT_RADIUS &&
				point.y <= el.y + el.height + ERASER_HIT_RADIUS
			) {
				this.#editor.commitSlides(removeElement(this.#editor.slides, current, el.id));
				return;
			}
		}
	}
}
