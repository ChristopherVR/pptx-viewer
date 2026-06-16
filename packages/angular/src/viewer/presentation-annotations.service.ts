/**
 * presentation-annotations.service.ts — Signal-based service that manages ink
 * annotation state during presentation mode.
 *
 * Ported from React:
 *   packages/react/src/viewer/hooks/usePresentationAnnotations.ts
 *   packages/react/src/viewer/hooks/usePresentationAnnotations.types.ts
 *
 * Provides: pen / highlighter / eraser / laser-pointer tools, per-slide stroke
 * storage keyed by slide index, begin / extend / end stroke lifecycle, undo
 * (single-step: clear current slide), clear-all, and a transient laser position.
 *
 * Provide at the component level so lifetime tracks the host overlay:
 * `@Component({ providers: [PresentationAnnotationsService] })`.
 */

import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import {
	ERASER_RADIUS,
	HIGHLIGHTER_OPACITY,
	HIGHLIGHTER_WIDTH,
	PEN_WIDTH,
	eraseAtPoint,
	nextStrokeId,
} from './presentation-annotations-helpers';
import type {
	AnnotationPoint,
	AnnotationStroke,
	LaserPosition,
	PresentationTool,
	SlideAnnotationMap,
} from './presentation-annotations-helpers';

// Re-export types so consumers only need to import from this service.
export type {
	AnnotationPoint,
	AnnotationStroke,
	LaserPosition,
	PresentationTool,
	SlideAnnotationMap,
};

@Injectable()
export class PresentationAnnotationsService {
	private readonly destroyRef = inject(DestroyRef);

	// ------------------------------------------------------------------
	// Private signals
	// ------------------------------------------------------------------

	private readonly _tool = signal<PresentationTool>('none');
	private readonly _penColor = signal<string>('#ff0000');
	private readonly _highlighterColor = signal<string>('#ffff00');
	private readonly _currentStroke = signal<AnnotationStroke | null>(null);
	private readonly _laserPosition = signal<LaserPosition | null>(null);
	private readonly _toolbarVisible = signal<boolean>(false);

	/**
	 * Strokes visible on the current slide. Cleared / populated whenever
	 * `setActiveSlide()` is called.
	 */
	private readonly _annotationStrokes = signal<AnnotationStroke[]>([]);

	/**
	 * Per-slide annotation storage. Strokes for the current slide are also kept
	 * in `_annotationStrokes` for rendering convenience; they are synchronised
	 * back into this map on `setActiveSlide()` or `endStroke()`.
	 */
	private readonly _slideAnnotations: SlideAnnotationMap = new Map();

	/** Tracks whether a pointer-down initiated an erase gesture. */
	private _isErasing = false;

	/** Toolbar auto-hide timer handle. */
	private _toolbarTimer: ReturnType<typeof setTimeout> | null = null;

	/** Index of the slide currently being annotated. */
	private _activeSlideIndex = 0;

	// ------------------------------------------------------------------
	// Public read-only signal surface
	// ------------------------------------------------------------------

	/** The currently-armed presentation tool. */
	readonly tool = computed<PresentationTool>(() => this._tool());

	/** Stroke colour used by the pen tool. */
	readonly penColor = computed<string>(() => this._penColor());

	/** Stroke colour used by the highlighter tool. */
	readonly highlighterColor = computed<string>(() => this._highlighterColor());

	/** Committed strokes on the active slide (does not include the live stroke). */
	readonly annotationStrokes = computed<AnnotationStroke[]>(() => this._annotationStrokes());

	/** The stroke currently being drawn, or null when not drawing. */
	readonly currentStroke = computed<AnnotationStroke | null>(() => this._currentStroke());

	/** Laser pointer position in slide-space pixels, or null when not visible. */
	readonly laserPosition = computed<LaserPosition | null>(() => this._laserPosition());

	/** Whether the annotation toolbar should be visible. */
	readonly toolbarVisible = computed<boolean>(() => this._toolbarVisible());

	/**
	 * `true` when any annotations exist on any slide (used for the
	 * "keep / discard" dialog when exiting presentation mode).
	 */
	readonly hasAnyAnnotations = computed<boolean>(
		() => this._annotationStrokes().length > 0 || this._slideAnnotations.size > 0,
	);

	// ------------------------------------------------------------------
	// Lifecycle
	// ------------------------------------------------------------------

	constructor() {
		this.destroyRef.onDestroy(() => {
			this._clearToolbarTimer();
		});
	}

	// ------------------------------------------------------------------
	// Tool management
	// ------------------------------------------------------------------

	/**
	 * Arm `tool`. If it is already armed, toggle back to `'none'` (matches
	 * the React behaviour of `setPresentationTool`).
	 */
	setTool(tool: PresentationTool): void {
		this._tool.update((current) => (current === tool ? 'none' : tool));
		// Clear transient state when switching away from drawing tools.
		if (this._tool() === 'none' || this._tool() === 'laser') {
			this._currentStroke.set(null);
			this._isErasing = false;
		}
		if (this._tool() !== 'laser') {
			this._laserPosition.set(null);
		}
	}

	/** Set the pen colour directly (without toggling the tool). */
	setPenColor(color: string): void {
		this._penColor.set(color);
	}

	/** Set the highlighter colour directly. */
	setHighlighterColor(color: string): void {
		this._highlighterColor.set(color);
	}

	/** Show / hide the toolbar programmatically. */
	setToolbarVisible(visible: boolean): void {
		this._toolbarVisible.set(visible);
	}

	// ------------------------------------------------------------------
	// Active slide management
	// ------------------------------------------------------------------

	/**
	 * Notify the service that the visible slide has changed. Saves the
	 * in-progress strokes for the previous slide and loads the strokes
	 * for `newIndex`.
	 */
	setActiveSlide(newIndex: number): void {
		if (newIndex === this._activeSlideIndex) {
			return;
		}
		this._flushCurrentSlide();
		this._activeSlideIndex = newIndex;
		const existing = this._slideAnnotations.get(newIndex) ?? [];
		this._annotationStrokes.set([...existing]);
		this._currentStroke.set(null);
		this._isErasing = false;
	}

	// ------------------------------------------------------------------
	// Drawing
	// ------------------------------------------------------------------

	/**
	 * Begin a stroke at `(x, y)` in slide-space coordinates.
	 * Called on pointer-down when the pen or highlighter is armed.
	 */
	beginStroke(x: number, y: number): void {
		const tool = this._tool();
		if (tool !== 'pen' && tool !== 'highlighter') {
			return;
		}
		const isPen = tool === 'pen';
		this._currentStroke.set({
			id: nextStrokeId(),
			points: [{ x, y }],
			color: isPen ? this._penColor() : this._highlighterColor(),
			width: isPen ? PEN_WIDTH : HIGHLIGHTER_WIDTH,
			opacity: isPen ? 1 : HIGHLIGHTER_OPACITY,
		});
	}

	/**
	 * Extend the active stroke by appending `(x, y)`.
	 * Called on pointer-move while drawing.
	 */
	extendStroke(x: number, y: number): void {
		this._currentStroke.update((prev) => {
			if (!prev) {
				return null;
			}
			return { ...prev, points: [...prev.points, { x, y }] };
		});
	}

	/**
	 * Commit the active stroke to the slide's annotation list.
	 * Called on pointer-up or pointer-leave while drawing.
	 * Strokes with fewer than 2 points are discarded.
	 */
	endStroke(): void {
		const stroke = this._currentStroke();
		this._currentStroke.set(null);
		if (!stroke || stroke.points.length < 2) {
			return;
		}
		this._annotationStrokes.update((prev) => {
			// Guard against duplicate ids (shouldn't happen, but matches React safety).
			if (prev.some((s) => s.id === stroke.id)) {
				return prev;
			}
			const updated = [...prev, stroke];
			this._slideAnnotations.set(this._activeSlideIndex, updated);
			return updated;
		});
	}

	// ------------------------------------------------------------------
	// Eraser
	// ------------------------------------------------------------------

	/**
	 * Begin an eraser gesture at `(x, y)`.
	 * Must be called on pointer-down when the eraser is armed.
	 */
	beginErase(x: number, y: number): void {
		if (this._tool() !== 'eraser') {
			return;
		}
		this._isErasing = true;
		this._applyErase(x, y);
	}

	/**
	 * Continue erasing at `(x, y)` during a pointer-move.
	 */
	continueErase(x: number, y: number): void {
		if (!this._isErasing || this._tool() !== 'eraser') {
			return;
		}
		this._applyErase(x, y);
	}

	/**
	 * End an eraser gesture. Called on pointer-up or pointer-leave.
	 */
	endErase(): void {
		this._isErasing = false;
	}

	// ------------------------------------------------------------------
	// Laser
	// ------------------------------------------------------------------

	/**
	 * Update the laser dot position (slide-space coords).
	 * Only takes effect when the laser tool is armed.
	 */
	moveLaser(x: number, y: number): void {
		if (this._tool() !== 'laser') {
			return;
		}
		this._laserPosition.set({ x, y });
	}

	/**
	 * Hide the laser dot (called on pointer-leave).
	 */
	hideLaser(): void {
		this._laserPosition.set(null);
	}

	// ------------------------------------------------------------------
	// Clear / undo
	// ------------------------------------------------------------------

	/**
	 * Clear all annotations on the active slide.
	 */
	clearAnnotations(): void {
		this._annotationStrokes.set([]);
		this._currentStroke.set(null);
		this._isErasing = false;
		this._slideAnnotations.delete(this._activeSlideIndex);
	}

	/**
	 * Clear all annotations across every slide.
	 */
	clearAllAnnotations(): void {
		this._annotationStrokes.set([]);
		this._currentStroke.set(null);
		this._isErasing = false;
		this._slideAnnotations.clear();
	}

	// ------------------------------------------------------------------
	// Snapshot
	// ------------------------------------------------------------------

	/**
	 * Return a snapshot of all annotations across every slide.
	 * The current slide's in-progress committed strokes are folded in.
	 *
	 * Used by the "keep as ink elements" dialog handler.
	 */
	getAllSlideAnnotations(): SlideAnnotationMap {
		this._flushCurrentSlide();
		return new Map(this._slideAnnotations);
	}

	// ------------------------------------------------------------------
	// Toolbar auto-hide
	// ------------------------------------------------------------------

	/**
	 * Show the toolbar and schedule it to auto-hide after `delayMs` (default 3 s).
	 * Resets the timer if called repeatedly (debounce on mouse-move).
	 */
	showToolbarTemporarily(delayMs = 3000): void {
		this._toolbarVisible.set(true);
		this._clearToolbarTimer();
		this._toolbarTimer = setTimeout(() => {
			this._toolbarVisible.set(false);
			this._toolbarTimer = null;
		}, delayMs);
	}

	// ------------------------------------------------------------------
	// Reset on exit
	// ------------------------------------------------------------------

	/**
	 * Reset transient presentation state (tool, current stroke, laser, toolbar
	 * timer). Does NOT clear stored strokes — those persist for the
	 * keep/discard dialog.
	 */
	resetForExit(): void {
		this._tool.set('none');
		this._currentStroke.set(null);
		this._laserPosition.set(null);
		this._isErasing = false;
		this._toolbarVisible.set(false);
		this._clearToolbarTimer();
	}

	// ------------------------------------------------------------------
	// Private helpers
	// ------------------------------------------------------------------

	private _applyErase(x: number, y: number): void {
		this._annotationStrokes.update((prev) => {
			const next = eraseAtPoint(prev, x, y, ERASER_RADIUS);
			if (next.length > 0) {
				this._slideAnnotations.set(this._activeSlideIndex, next);
			} else {
				this._slideAnnotations.delete(this._activeSlideIndex);
			}
			return next;
		});
	}

	private _flushCurrentSlide(): void {
		const strokes = this._annotationStrokes();
		if (strokes.length > 0) {
			this._slideAnnotations.set(this._activeSlideIndex, [...strokes]);
		} else {
			this._slideAnnotations.delete(this._activeSlideIndex);
		}
	}

	private _clearToolbarTimer(): void {
		if (this._toolbarTimer !== null) {
			clearTimeout(this._toolbarTimer);
			this._toolbarTimer = null;
		}
	}
}
