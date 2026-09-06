import type { InkPoint, InkStrokeView } from 'pptx-viewer-shared';
import {
	buildLiveInkStrokeView,
	findEraserHitElementId,
	pointsToSvgPathD,
	removeElement,
	strokeToInkElement,
} from 'pptx-viewer-shared';

import { strokeToFreeformShape } from './editor-freeform';
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
	/**
	 * The in-progress stroke's render view (plain path, pressure circles, or
	 * tilt nib marks), from the shared `buildLiveInkStrokeView`: the same
	 * decision `InkView.svelte` makes for a committed stroke (via
	 * `buildInkStrokes`), fed the SAME accumulated points {@link commitStroke}
	 * hands to `strokeToInkElement`. `null` while idle.
	 */
	liveStrokeView: InkStrokeView | null = $state(null);

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
		this.liveStrokeView = null;
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

	/**
	 * Update the live preview while a pen/highlighter/freeform stroke is in
	 * progress: both the plain `livePathD` (kept for existing consumers) and
	 * `liveStrokeView`, the same plain-path/pressure-circle/tilt-nib decision
	 * a committed stroke gets from `buildInkStrokes`, built from the identical
	 * accumulated points.
	 */
	previewStroke(points: readonly InkPoint[]): void {
		const pts = [...points];
		this.livePathD = pointsToSvgPathD(pts);
		this.liveStrokeView = buildLiveInkStrokeView({
			points: pts,
			color: this.color,
			width: this.width,
			tool:
				this.tool === 'highlighter' ? 'highlighter' : this.tool === 'freeform' ? 'freeform' : 'pen',
		});
	}

	/**
	 * Finalise the in-progress stroke (undoable via `EditorState.insertElement`),
	 * or discard it silently when too short (a plain tap) or the tool changed
	 * mid-gesture. Pen/highlighter commit an `ink` element; freeform commits a
	 * closed custom-geometry `shape`.
	 */
	commitStroke(points: readonly InkPoint[]): void {
		this.livePathD = '';
		this.liveStrokeView = null;
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
	 * Hit-test `ink`/`contentPart` elements on the current slide at `point`
	 * (topmost first) and delete the first match, with history. `contentPart`
	 * is included because ink saved via the Draw tab reloads in that shape, so
	 * it must stay erasable after a save/reload round-trip. No-op when nothing
	 * is hit.
	 */
	eraseElementAt(point: InkPoint): void {
		const current = this.#editor.currentSlideIndex;
		const elements = this.#editor.slides[current]?.elements ?? [];
		const hitId = findEraserHitElementId(elements, point);
		if (hitId) {
			this.#editor.commitSlides(removeElement(this.#editor.slides, current, hitId));
		}
	}
}
