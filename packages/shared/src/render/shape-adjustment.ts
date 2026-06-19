/**
 * Shape-adjustment handle helpers (round-rect corner radius). Pure,
 * framework-agnostic math shared by every binding (React / Vue / Angular).
 *
 * Owns the adjustment scalar constants and the handle/drag descriptor types so
 * each binding consumes one copy rather than re-declaring them.
 */
import type { PptxElement, PptxElementWithShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

// Scalar constants (mirrors the React `viewer/constants/scalar.ts` values).
const MIN_ELEMENT_SIZE = 12;
export const SHAPE_ADJUSTMENT_MIN = 0;
export const SHAPE_ADJUSTMENT_MAX = 50000;
export const DEFAULT_ROUND_RECT_ADJUSTMENT = 16667;

/** Descriptor for the draggable adjustment handle (the amber diamond). */
export interface ShapeAdjustmentHandleDescriptor {
	key: string;
	/** Handle x offset in element-local px (origin = element top-left). */
	left: number;
	/** Handle y offset in element-local px. */
	top: number;
	/** Current adjustment value (0–50000). */
	value: number;
	cursor: string;
}

/** Live drag state captured when an adjustment gesture starts. */
export interface ShapeAdjustmentDragState {
	elementId: string;
	key: string;
	shapeType: string;
	startClientX: number;
	startClientY: number;
	startAdjustment: number;
	startWidth: number;
	startHeight: number;
	moved: boolean;
}

export function clampShapeAdjustmentValue(value: number): number {
	return Math.max(SHAPE_ADJUSTMENT_MIN, Math.min(SHAPE_ADJUSTMENT_MAX, Math.round(value)));
}

export function getRoundRectAdjustmentValue(element: PptxElementWithShapeStyle): number {
	const adjustment = element.shapeAdjustments?.adj;
	if (typeof adjustment === 'number' && Number.isFinite(adjustment)) {
		return clampShapeAdjustmentValue(adjustment);
	}
	return DEFAULT_ROUND_RECT_ADJUSTMENT;
}

export function getRoundRectRadiusPx(element: PptxElementWithShapeStyle): number {
	const normalizedAdjustment = getRoundRectAdjustmentValue(element) / SHAPE_ADJUSTMENT_MAX;
	return (
		Math.min(Math.max(element.width, 1), Math.max(element.height, 1)) * 0.5 * normalizedAdjustment
	);
}

/**
 * The adjustment handle descriptor for `element`, or `null` when the element
 * type has no adjustable parameter (only round-rects are handled today).
 */
export function getShapeAdjustmentHandleDescriptor(
	element: PptxElement,
): ShapeAdjustmentHandleDescriptor | null {
	if (!hasShapeProperties(element)) {
		return null;
	}
	const normalizedShapeType = String(element.shapeType || '').toLowerCase();
	if (normalizedShapeType !== 'roundrect') {
		return null;
	}

	const adjustmentValue = getRoundRectAdjustmentValue(element);
	const radiusPx = getRoundRectRadiusPx(element);
	const maxWidth = Math.max(element.width, MIN_ELEMENT_SIZE);
	const handleInset = 5;
	const left = Math.max(handleInset, Math.min(maxWidth - handleInset, Math.round(radiusPx)));

	return {
		key: 'adj',
		left,
		top: -8,
		value: adjustmentValue,
		cursor: 'ew-resize',
	};
}

/** New adjustment value for a drag delta (px) from the gesture start. */
export function getDraggedShapeAdjustmentValue(
	state: ShapeAdjustmentDragState,
	deltaX: number,
): number {
	if (state.shapeType !== 'roundrect') {
		return state.startAdjustment;
	}
	const minDimension = Math.max(
		1,
		Math.min(Math.max(state.startWidth, 1), Math.max(state.startHeight, 1)),
	);
	const deltaAdjustment = (deltaX / Math.max(minDimension * 0.5, 1)) * SHAPE_ADJUSTMENT_MAX;
	return clampShapeAdjustmentValue(state.startAdjustment + deltaAdjustment);
}
