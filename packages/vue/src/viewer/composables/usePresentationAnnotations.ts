/**
 * `usePresentationAnnotations`: Vue port of the React
 * `usePresentationAnnotations` hook.
 *
 * Provides pen, highlighter, eraser, and laser-pointer tools that overlay the
 * slide canvas during presentation mode. Strokes are tracked **per slide** (so
 * they reappear when navigating back), and the eraser/clear math is pure so it
 * is unit-testable without a DOM.
 *
 * Mirrors the React semantics:
 *  - `setPresentationTool(tool)` toggles the tool (selecting the active tool
 *    again returns to `'none'`); it is a no-op while `isActive` is `false`.
 *  - When the active slide changes the current slide's strokes are saved into a
 *    per-slide map and the new slide's strokes are loaded.
 *  - Pen draws an opaque thin stroke; highlighter a wide translucent stroke.
 *  - The eraser removes any stroke whose points fall within `ERASER_RADIUS` of
 *    the erase point.
 *
 * @module composables/usePresentationAnnotations
 */

import { computed, ref, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresentationTool = 'none' | 'laser' | 'pen' | 'highlighter' | 'eraser';

export interface AnnotationPoint {
	x: number;
	y: number;
}

export interface AnnotationStroke {
	id: string;
	points: AnnotationPoint[];
	color: string;
	width: number;
	opacity: number;
}

export interface LaserPosition {
	x: number;
	y: number;
}

/** Annotations grouped by slide index. */
export type SlideAnnotationMap = Map<number, AnnotationStroke[]>;

export interface UsePresentationAnnotationsOptions {
	/** Whether presentation mode (and thus annotation capture) is active. */
	isActive: MaybeRefOrGetter<boolean>;
	/** Current slide index, used to track which slide annotations belong to. */
	activeSlideIndex: MaybeRefOrGetter<number>;
}

export interface UsePresentationAnnotationsResult {
	presentationTool: Ref<PresentationTool>;
	setPresentationTool: (tool: PresentationTool) => void;
	penColor: Ref<string>;
	setPenColor: (color: string) => void;
	highlighterColor: Ref<string>;
	setHighlighterColor: (color: string) => void;
	/** Completed strokes on the active slide. */
	annotationStrokes: Ref<AnnotationStroke[]>;
	/** The in-progress stroke (pen/highlighter), or `null`. */
	currentStroke: Ref<AnnotationStroke | null>;
	/** The current laser-pointer position, or `null`. */
	laserPosition: Ref<LaserPosition | null>;
	handlePointerDown: (x: number, y: number) => void;
	handlePointerMove: (x: number, y: number) => void;
	handlePointerUp: () => void;
	handleLaserMove: (x: number, y: number) => void;
	handleLaserLeave: () => void;
	eraseAtPoint: (x: number, y: number) => void;
	/** Clear the active slide's annotations. */
	clearAnnotations: () => void;
	/** Clear annotations on every slide. */
	clearAllAnnotations: () => void;
	/** All annotations across all slides (for persistence on exit). */
	allSlideAnnotations: ComputedRef<SlideAnnotationMap>;
	/** Whether any annotations exist across all slides. */
	hasAnyAnnotations: ComputedRef<boolean>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PEN_WIDTH = 2.5;
export const HIGHLIGHTER_WIDTH = 14;
export const HIGHLIGHTER_OPACITY = 0.4;
export const ERASER_RADIUS = 16;

let strokeIdCounter = 0;
function nextStrokeId(): string {
	strokeIdCounter += 1;
	return `stroke-${strokeIdCounter}`;
}

// ---------------------------------------------------------------------------
// Pure stroke math (DOM-free, unit-testable)
// ---------------------------------------------------------------------------

/** Build a new stroke for the given pen/highlighter tool at a start point. */
export function createStroke(
	tool: 'pen' | 'highlighter',
	x: number,
	y: number,
	penColor: string,
	highlighterColor: string,
): AnnotationStroke {
	const isPen = tool === 'pen';
	return {
		id: nextStrokeId(),
		points: [{ x, y }],
		color: isPen ? penColor : highlighterColor,
		width: isPen ? PEN_WIDTH : HIGHLIGHTER_WIDTH,
		opacity: isPen ? 1 : HIGHLIGHTER_OPACITY,
	};
}

/**
 * Remove any stroke that passes within `radius` of `(x, y)`. Returns a new
 * array (never mutates the input); identity-equal to the input when nothing
 * was erased.
 */
export function eraseStrokesAtPoint(
	strokes: AnnotationStroke[],
	x: number,
	y: number,
	radius = ERASER_RADIUS,
): AnnotationStroke[] {
	const r2 = radius * radius;
	const filtered = strokes.filter(
		(stroke) =>
			!stroke.points.some((pt) => {
				const dx = pt.x - x;
				const dy = pt.y - y;
				return dx * dx + dy * dy < r2;
			}),
	);
	return filtered.length === strokes.length ? strokes : filtered;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function usePresentationAnnotations(
	options: UsePresentationAnnotationsOptions,
): UsePresentationAnnotationsResult {
	const presentationTool = ref<PresentationTool>('none');
	const penColor = ref('#ff0000');
	const highlighterColor = ref('#ffff00');
	const annotationStrokes = ref<AnnotationStroke[]>([]);
	const currentStroke = ref<AnnotationStroke | null>(null);
	const laserPosition = ref<LaserPosition | null>(null);

	// Per-slide stroke storage + a version counter so the `hasAnyAnnotations`
	// computed re-derives when the (non-reactive) map mutates.
	const slideAnnotations: SlideAnnotationMap = new Map();
	const annotationVersion = ref(0);

	let isDrawing = false;
	let prevSlideIndex = toValue(options.activeSlideIndex);

	function bumpVersion(): void {
		annotationVersion.value += 1;
	}

	// When the active slide changes during presentation, save the current
	// slide's strokes and load the new slide's strokes.
	watch(
		() => toValue(options.activeSlideIndex),
		(nextIndex) => {
			if (!toValue(options.isActive)) {
				prevSlideIndex = nextIndex;
				return;
			}
			if (prevSlideIndex === nextIndex) {
				return;
			}
			if (annotationStrokes.value.length > 0) {
				slideAnnotations.set(prevSlideIndex, annotationStrokes.value);
			} else {
				slideAnnotations.delete(prevSlideIndex);
			}
			annotationStrokes.value = slideAnnotations.get(nextIndex) ?? [];
			currentStroke.value = null;
			isDrawing = false;
			bumpVersion();
			prevSlideIndex = nextIndex;
		},
		{ flush: 'sync' },
	);

	// Reset transient state when presentation mode deactivates. Strokes are NOT
	// cleared; they persist until the caller keeps or discards them.
	watch(
		() => toValue(options.isActive),
		(active) => {
			if (!active) {
				presentationTool.value = 'none';
				currentStroke.value = null;
				laserPosition.value = null;
				isDrawing = false;
			}
		},
		{ flush: 'sync' },
	);

	function setPresentationTool(tool: PresentationTool): void {
		if (!toValue(options.isActive)) {
			return;
		}
		presentationTool.value = presentationTool.value === tool ? 'none' : tool;
	}

	function setPenColor(color: string): void {
		penColor.value = color;
	}

	function setHighlighterColor(color: string): void {
		highlighterColor.value = color;
	}

	// -- Drawing ----------------------------------------------------------------

	function handlePointerDown(x: number, y: number): void {
		if (!toValue(options.isActive)) {
			return;
		}
		const tool = presentationTool.value;
		if (tool === 'pen' || tool === 'highlighter') {
			isDrawing = true;
			currentStroke.value = createStroke(tool, x, y, penColor.value, highlighterColor.value);
		}
	}

	function handlePointerMove(x: number, y: number): void {
		if (!toValue(options.isActive) || !isDrawing) {
			return;
		}
		const stroke = currentStroke.value;
		if (!stroke) {
			return;
		}
		currentStroke.value = { ...stroke, points: [...stroke.points, { x, y }] };
	}

	function handlePointerUp(): void {
		if (!isDrawing) {
			return;
		}
		isDrawing = false;
		const stroke = currentStroke.value;
		currentStroke.value = null;
		if (stroke && stroke.points.length > 1) {
			if (annotationStrokes.value.some((s) => s.id === stroke.id)) {
				return;
			}
			const updated = [...annotationStrokes.value, stroke];
			annotationStrokes.value = updated;
			slideAnnotations.set(toValue(options.activeSlideIndex), updated);
			bumpVersion();
		}
	}

	// -- Laser ------------------------------------------------------------------

	function handleLaserMove(x: number, y: number): void {
		if (!toValue(options.isActive) || presentationTool.value !== 'laser') {
			return;
		}
		laserPosition.value = { x, y };
	}

	function handleLaserLeave(): void {
		laserPosition.value = null;
	}

	// -- Eraser -----------------------------------------------------------------

	function eraseAtPoint(x: number, y: number): void {
		if (!toValue(options.isActive) || presentationTool.value !== 'eraser') {
			return;
		}
		const filtered = eraseStrokesAtPoint(annotationStrokes.value, x, y);
		if (filtered === annotationStrokes.value) {
			return;
		}
		annotationStrokes.value = filtered;
		const idx = toValue(options.activeSlideIndex);
		if (filtered.length > 0) {
			slideAnnotations.set(idx, filtered);
		} else {
			slideAnnotations.delete(idx);
		}
		bumpVersion();
	}

	// -- Clearing ---------------------------------------------------------------

	function clearAnnotations(): void {
		annotationStrokes.value = [];
		currentStroke.value = null;
		isDrawing = false;
		slideAnnotations.delete(toValue(options.activeSlideIndex));
		bumpVersion();
	}

	function clearAllAnnotations(): void {
		annotationStrokes.value = [];
		currentStroke.value = null;
		isDrawing = false;
		slideAnnotations.clear();
		bumpVersion();
	}

	// -- Derived ----------------------------------------------------------------

	const allSlideAnnotations = computed<SlideAnnotationMap>(() => {
		// `annotationVersion` is referenced so the computed re-derives when the
		// underlying (non-reactive) map mutates.
		void annotationVersion.value;
		const map = new Map(slideAnnotations);
		if (annotationStrokes.value.length > 0) {
			map.set(toValue(options.activeSlideIndex), annotationStrokes.value);
		}
		return map;
	});

	const hasAnyAnnotations = computed<boolean>(() => {
		void annotationVersion.value;
		return annotationStrokes.value.length > 0 || slideAnnotations.size > 0;
	});

	return {
		presentationTool,
		setPresentationTool,
		penColor,
		setPenColor,
		highlighterColor,
		setHighlighterColor,
		annotationStrokes,
		currentStroke,
		laserPosition,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handleLaserMove,
		handleLaserLeave,
		eraseAtPoint,
		clearAnnotations,
		clearAllAnnotations,
		allSlideAnnotations,
		hasAnyAnnotations,
	};
}
