/**
 * Shape adjustment handle helpers for the PowerPoint editor.
 */
import type {
  PptxElement,
  PptxElementWithShapeStyle,
} from "../../core";
import { hasShapeProperties } from "../../core";
import {
  DEFAULT_ROUND_RECT_ADJUSTMENT,
  MIN_ELEMENT_SIZE,
  SHAPE_ADJUSTMENT_MAX,
  SHAPE_ADJUSTMENT_MIN,
} from "../constants";
import type {
  ShapeAdjustmentDragState,
  ShapeAdjustmentHandleDescriptor,
} from "../types";

export function clampShapeAdjustmentValue(value: number): number {
  return Math.max(
    SHAPE_ADJUSTMENT_MIN,
    Math.min(SHAPE_ADJUSTMENT_MAX, Math.round(value)),
  );
}

export function getRoundRectAdjustmentValue(
  element: PptxElementWithShapeStyle,
): number {
  const adjustment = element.shapeAdjustments?.adj;
  if (typeof adjustment === "number" && Number.isFinite(adjustment)) {
    return clampShapeAdjustmentValue(adjustment);
  }
  return DEFAULT_ROUND_RECT_ADJUSTMENT;
}

export function getRoundRectRadiusPx(
  element: PptxElementWithShapeStyle,
): number {
  const normalizedAdjustment =
    getRoundRectAdjustmentValue(element) / SHAPE_ADJUSTMENT_MAX;
  return (
    Math.min(Math.max(element.width, 1), Math.max(element.height, 1)) *
    0.5 *
    normalizedAdjustment
  );
}

export function getShapeAdjustmentHandleDescriptor(
  element: PptxElement,
): ShapeAdjustmentHandleDescriptor | null {
  if (!hasShapeProperties(element)) return null;
  const normalizedShapeType = String(element.shapeType || "").toLowerCase();
  if (normalizedShapeType !== "roundrect") return null;

  const adjustmentValue = getRoundRectAdjustmentValue(element);
  const radiusPx = getRoundRectRadiusPx(element);
  const maxWidth = Math.max(element.width, MIN_ELEMENT_SIZE);
  const handleInset = 5;
  const left = Math.max(
    handleInset,
    Math.min(maxWidth - handleInset, Math.round(radiusPx)),
  );

  return {
    key: "adj",
    left,
    top: -8,
    value: adjustmentValue,
    cursor: "ew-resize",
  };
}

export function getDraggedShapeAdjustmentValue(
  state: ShapeAdjustmentDragState,
  deltaX: number,
): number {
  if (state.shapeType !== "roundrect") {
    return state.startAdjustment;
  }
  const minDimension = Math.max(
    1,
    Math.min(Math.max(state.startWidth, 1), Math.max(state.startHeight, 1)),
  );
  const deltaAdjustment =
    (deltaX / Math.max(minDimension * 0.5, 1)) * SHAPE_ADJUSTMENT_MAX;
  return clampShapeAdjustmentValue(state.startAdjustment + deltaAdjustment);
}
