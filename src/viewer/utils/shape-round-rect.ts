import type { PptxElementWithShapeStyle } from "../../core";
import {
  SHAPE_ADJUSTMENT_MAX,
  SHAPE_ADJUSTMENT_MIN,
  DEFAULT_ROUND_RECT_ADJUSTMENT,
} from "../constants";

function localClampAdjustment(value: number): number {
  return Math.max(
    SHAPE_ADJUSTMENT_MIN,
    Math.min(SHAPE_ADJUSTMENT_MAX, Math.round(value)),
  );
}

export function getRoundRectRadiusPx(
  element: PptxElementWithShapeStyle,
): number {
  const adjustment = element.shapeAdjustments?.adj;
  const adjValue =
    typeof adjustment === "number" && Number.isFinite(adjustment)
      ? localClampAdjustment(adjustment)
      : DEFAULT_ROUND_RECT_ADJUSTMENT;
  const normalizedAdjustment = adjValue / SHAPE_ADJUSTMENT_MAX;
  return (
    Math.min(Math.max(element.width, 1), Math.max(element.height, 1)) *
    0.5 *
    normalizedAdjustment
  );
}
