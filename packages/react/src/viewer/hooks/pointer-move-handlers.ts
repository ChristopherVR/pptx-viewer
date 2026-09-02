/**
 * Extracted pointer-move processing logic for usePointerHandlers.
 * Handles marquee, drag, resize, and shape-adjustment interactions.
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	applyResize,
	getDraggedShapeAdjustments,
	lockResizeAspect,
	publishLiveGeometry,
	snapBoxToGrid,
} from 'pptx-viewer-shared';
import type { ResizeHandleId } from 'pptx-viewer-shared';

import { MIN_ELEMENT_SIZE } from '../constants';
import { computeSnapToShapeResult } from '../utils/geometry-selection';
import { syncSelectionHandleOverlay } from '../utils/selection-handle-overlay';
import type { UsePointerHandlersInput, PointerFrameTracker } from './pointer-handler-types';

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testing)
// ---------------------------------------------------------------------------

export interface ResizeGeometry {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Compute new resize geometry from an (element-space) delta and handle position.
 *
 * The core 8-handle resize is the shared `applyResize` (called with `zoom = 1`
 * since `dx`/`dy` are already in element px and the element is axis-aligned).
 * When `lockAspect` is set (Shift held) on a corner handle, the shared
 * `lockResizeAspect` constrains the result to the start box's aspect ratio
 * before the shared per-edge grid snap runs (when `snapToGrid` is set).
 */
export function computeResizeGeometry(
	handle: ResizeHandleId,
	startX: number,
	startY: number,
	startWidth: number,
	startHeight: number,
	dx: number,
	dy: number,
	snapToGrid: boolean,
	gridSpacingPx: number,
	lockAspect = false,
): ResizeGeometry {
	const startBox = { x: startX, y: startY, width: startWidth, height: startHeight };
	let resized = applyResize(startBox, handle, dx, dy, 1, { minSize: MIN_ELEMENT_SIZE });
	if (lockAspect) {
		resized = lockResizeAspect(resized, startBox, handle, MIN_ELEMENT_SIZE);
	}
	const box = { x: resized.x, y: resized.y, width: resized.width, height: resized.height };
	if (!snapToGrid) {
		return box;
	}
	return snapBoxToGrid(box, handle, gridSpacingPx, MIN_ELEMENT_SIZE);
}

// ---------------------------------------------------------------------------
// Collaboration live preview
// ---------------------------------------------------------------------------

/**
 * Where interim gesture geometry is published so peers see the move live.
 * `undefined` whenever the gesture must not be mirrored (no collaboration, or
 * edit-template mode, whose elements live outside the shared slides array).
 */
interface LiveGeometryTarget {
	patcher: NonNullable<UsePointerHandlersInput['livePatcher']>;
	slideId: string | undefined;
}

function resolveLiveTarget(input: UsePointerHandlersInput): LiveGeometryTarget | undefined {
	const { livePatcher, editTemplateMode, activeSlide } = input;
	if (!livePatcher || editTemplateMode || !livePatcher.isActive()) {
		return undefined;
	}
	return { patcher: livePatcher, slideId: activeSlide?.id };
}

// ---------------------------------------------------------------------------
// Main pointer-move processor
// ---------------------------------------------------------------------------

export function processPointerMove(
	e: PointerEvent,
	input: UsePointerHandlersInput,
	tracker: PointerFrameTracker,
): void {
	const {
		editorScale,
		canvasStageRef,
		canvasSize,
		snapToGrid,
		snapToShape,
		gridSpacingPx,
		editTemplateMode,
		templateElements,
		activeSlide,
		guides,
		elementLookup,
		marqueeStateRef,
		dragStateRef,
		resizeStateRef,
		shapeAdjustmentDragStateRef,
		setMarqueeSelectionState,
		setSnapLines,
		updateElementById,
	} = input;

	const marquee = marqueeStateRef.current;
	if (marquee) {
		processMarqueeMove(
			e,
			marquee,
			canvasStageRef,
			canvasSize,
			editorScale,
			setMarqueeSelectionState,
		);
		return;
	}

	const drag = dragStateRef.current;
	if (drag) {
		processDragMove(
			e,
			drag,
			editorScale,
			snapToGrid,
			snapToShape,
			gridSpacingPx,
			editTemplateMode,
			templateElements,
			activeSlide,
			guides,
			elementLookup,
			tracker,
			setSnapLines,
			resolveLiveTarget(input),
		);
		return;
	}

	const rs = resizeStateRef.current;
	if (rs) {
		processResizeMove(e, rs, editorScale, snapToGrid, gridSpacingPx, resolveLiveTarget(input));
		return;
	}

	const adj = shapeAdjustmentDragStateRef.current;
	if (adj) {
		processAdjustmentMove(e, adj, editorScale, updateElementById);
	}
}

// ── Marquee ──────────────────────────────────────────────────────────────────

function processMarqueeMove(
	e: PointerEvent,
	marquee: NonNullable<UsePointerHandlersInput['marqueeStateRef']['current']>,
	canvasStageRef: UsePointerHandlersInput['canvasStageRef'],
	canvasSize: UsePointerHandlersInput['canvasSize'],
	editorScale: number,
	setMarqueeSelectionState: UsePointerHandlersInput['setMarqueeSelectionState'],
): void {
	const stage = canvasStageRef.current;
	if (!stage) {
		return;
	}
	const rect = stage.getBoundingClientRect();
	marquee.currentX = Math.max(0, Math.min(canvasSize.width, (e.clientX - rect.left) / editorScale));
	marquee.currentY = Math.max(0, Math.min(canvasSize.height, (e.clientY - rect.top) / editorScale));
	setMarqueeSelectionState({ ...marquee });
}

// ── Drag ─────────────────────────────────────────────────────────────────────

function processDragMove(
	e: PointerEvent,
	drag: NonNullable<UsePointerHandlersInput['dragStateRef']['current']>,
	editorScale: number,
	snapToGrid: boolean,
	snapToShape: boolean,
	gridSpacingPx: number,
	editTemplateMode: boolean,
	templateElements: PptxElement[],
	activeSlide: UsePointerHandlersInput['activeSlide'],
	guides: UsePointerHandlersInput['guides'],
	elementLookup: UsePointerHandlersInput['elementLookup'],
	tracker: PointerFrameTracker,
	setSnapLines: UsePointerHandlersInput['setSnapLines'],
	live: LiveGeometryTarget | undefined,
): void {
	const dx = (e.clientX - drag.startClientX) / editorScale;
	const dy = (e.clientY - drag.startClientY) / editorScale;
	if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
		drag.moved = true;
	}
	if (!drag.moved) {
		return;
	}

	let appliedDx = dx;
	let appliedDy = dy;
	const draggedIds = Object.keys(drag.startPositionsById);
	const primaryId = draggedIds[0];
	const primaryStart = primaryId ? drag.startPositionsById[primaryId] : undefined;
	const primaryEl = primaryId ? elementLookup.get(primaryId) : undefined;

	if (primaryStart && primaryEl) {
		let targetX = primaryStart.x + appliedDx;
		let targetY = primaryStart.y + appliedDy;
		if (snapToGrid) {
			targetX = Math.round(targetX / gridSpacingPx) * gridSpacingPx;
			targetY = Math.round(targetY / gridSpacingPx) * gridSpacingPx;
		}
		if (snapToShape) {
			// While editing templates the snap siblings come from the template
			// store; otherwise from the active slide's elements.
			const siblingSource = editTemplateMode ? templateElements : (activeSlide?.elements ?? []);
			const siblings = siblingSource.map((el) => ({
				id: el.id,
				x: el.x,
				y: el.y,
				width: el.width,
				height: el.height,
			}));
			const snapResult = computeSnapToShapeResult(
				targetX,
				targetY,
				primaryEl.width,
				primaryEl.height,
				siblings,
				new Set(draggedIds),
				guides.map((g) => ({ axis: g.axis, position: g.position })),
			);
			targetX = snapResult.x;
			targetY = snapResult.y;
			const newSnapLines = snapResult.lines.map((line) => ({
				axis: line.axis === 'v' ? 'x' : 'y',
				position: line.position,
			}));
			const newKey = JSON.stringify(newSnapLines);
			if (newKey !== tracker.lastSnapLinesKey) {
				tracker.lastSnapLinesKey = newKey;
				setSnapLines(newSnapLines as { axis: 'x' | 'y'; position: number }[]);
			}
		} else if (tracker.lastSnapLinesKey !== '[]') {
			tracker.lastSnapLinesKey = '[]';
			setSnapLines([]);
		}
		appliedDx = targetX - primaryStart.x;
		appliedDy = targetY - primaryStart.y;
	}
	drag.lastDx = appliedDx;
	drag.lastDy = appliedDy;
	for (const [id, domEl] of drag.domEls) {
		const start = drag.startPositionsById[id];
		if (start) {
			const x = start.x + appliedDx;
			const y = start.y + appliedDy;
			domEl.style.left = `${x}px`;
			domEl.style.top = `${y}px`;
			syncSelectionHandleOverlay(id, { x, y });
		}
	}
	// Mirror the in-flight positions to collaborators. The DOM writes above
	// deliberately bypass React state, so this is the only thing peers can see
	// before the pointer-up commit.
	if (live) {
		for (const id of Object.keys(drag.startPositionsById)) {
			const start = drag.startPositionsById[id];
			publishLiveGeometry(live.patcher, live.slideId, id, {
				x: start.x + appliedDx,
				y: start.y + appliedDy,
			});
		}
	}
}

// ── Resize ───────────────────────────────────────────────────────────────────

function processResizeMove(
	e: PointerEvent,
	rs: NonNullable<UsePointerHandlersInput['resizeStateRef']['current']>,
	editorScale: number,
	snapToGrid: boolean,
	gridSpacingPx: number,
	live: LiveGeometryTarget | undefined,
): void {
	const dx = (e.clientX - rs.startClientX) / editorScale;
	const dy = (e.clientY - rs.startClientY) / editorScale;
	if (!rs.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
		rs.moved = true;
	}
	if (!rs.moved) {
		return;
	}

	const geo = computeResizeGeometry(
		rs.handle,
		rs.startX,
		rs.startY,
		rs.startWidth,
		rs.startHeight,
		dx,
		dy,
		snapToGrid,
		gridSpacingPx,
		e.shiftKey,
	);
	rs.lastX = geo.x;
	rs.lastY = geo.y;
	rs.lastWidth = geo.width;
	rs.lastHeight = geo.height;
	const width = Math.max(geo.width, MIN_ELEMENT_SIZE);
	const height = Math.max(geo.height, MIN_ELEMENT_SIZE);
	if (rs.domEl) {
		rs.domEl.style.left = `${geo.x}px`;
		rs.domEl.style.top = `${geo.y}px`;
		rs.domEl.style.width = `${width}px`;
		rs.domEl.style.height = `${height}px`;
	}
	syncSelectionHandleOverlay(rs.elementId, { x: geo.x, y: geo.y, width, height });
	if (live) {
		publishLiveGeometry(live.patcher, live.slideId, rs.elementId, {
			x: geo.x,
			y: geo.y,
			width,
			height,
		});
	}
}

// ── Shape adjustment ─────────────────────────────────────────────────────────

function processAdjustmentMove(
	e: PointerEvent,
	adj: NonNullable<UsePointerHandlersInput['shapeAdjustmentDragStateRef']['current']>,
	editorScale: number,
	updateElementById: UsePointerHandlersInput['updateElementById'],
): void {
	const dx = (e.clientX - adj.startClientX) / editorScale;
	// Both axes: a handle only travels horizontally on a round-rect. An arrow's
	// shaft thickness, a callout's leader line and a pie wedge's sweep all need
	// the vertical component, and feeding 0 pinned them to their start value.
	const dy = (e.clientY - adj.startClientY) / editorScale;
	// Shared owns the adjustment maths for all five bindings. React used to keep
	// a private `computeAdjustmentValue` that clamped the result to 0..1, but an
	// `a:avLst` adjustment is a 0..50000 guide value: any drag therefore collapsed
	// a 16667 corner radius to 1, i.e. to nothing. Its unit tests passed because
	// they asserted the same wrong scale.
	const adjustments = getDraggedShapeAdjustments(adj, dx, dy);
	if (!adj.moved && Math.hypot(dx, dy) > 2) {
		adj.moved = true;
	}
	if (adj.moved) {
		// The WHOLE map, not one key: `shapeAdjustments` is replaced wholesale by
		// `updateElementById`, so writing only the dragged guide would delete the
		// other two on a `quadArrow`.
		updateElementById(adj.elementId, {
			shapeAdjustments: adjustments,
		} as Partial<PptxElement>);
	}
}
