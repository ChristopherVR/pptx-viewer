import React from "react";
import type { CSSProperties } from "react";
import type { PptxElement } from "../../../core";
import { MIN_ELEMENT_SIZE } from "../../constants";
import {
  getElementTransform,
  getCropShapeClipPath,
  hasDagDuotoneEffect,
  renderDagDuotoneSvgFilter,
} from "../../utils";
import type { ElementAnimationState } from "../../utils/animation-timeline";

/* ───────────────────────── DagDuotone SVG filter ──────────────────────── */

interface DagDuotoneShape {
  shapeStyle?: {
    dagDuotone?: { color1: string; color2: string };
  };
}

/**
 * Renders the inline SVG `<filter>` element needed for dag-duotone image
 * effects.  Returns `null` when the element has no duotone.
 */
export function renderDagDuotoneFilterForElement(
  el: PptxElement,
): React.ReactNode {
  if (!hasDagDuotoneEffect(el)) return null;
  const duotone = (el as DagDuotoneShape).shapeStyle?.dagDuotone;
  if (!duotone) return null;
  return renderDagDuotoneSvgFilter(el.id, duotone.color1, duotone.color2);
}

/* ──────────────────── Container style computation ─────────────────────── */

interface ContainerStyleParams {
  el: PptxElement;
  isFullscreenMedia: boolean;
  isImg: boolean;
  zIndex: number | undefined;
  opacity: number | undefined;
  animationState: ElementAnimationState | undefined;
  shapeVisualStyle: CSSProperties;
}

/** Builds the `style` object for the outermost element container `<div>`. */
export function getContainerStyle({
  el,
  isFullscreenMedia,
  isImg,
  zIndex,
  opacity,
  animationState,
  shapeVisualStyle,
}: ContainerStyleParams): CSSProperties {
  return {
    left: isFullscreenMedia ? 0 : el.x,
    top: isFullscreenMedia ? 0 : el.y,
    width: isFullscreenMedia ? "100%" : Math.max(el.width, MIN_ELEMENT_SIZE),
    height: isFullscreenMedia ? "100%" : Math.max(el.height, MIN_ELEMENT_SIZE),
    transform: isFullscreenMedia ? "none" : getElementTransform(el),
    transformOrigin: "center",
    overflow: isImg ? "hidden" : undefined,
    clipPath: isImg ? getCropShapeClipPath(el) : undefined,
    zIndex: isFullscreenMedia ? 20 : zIndex,
    opacity,
    visibility: animationState?.visible === false ? "hidden" : "visible",
    animation: animationState?.cssAnimation,
    background: isFullscreenMedia ? "#000" : undefined,
    transition: isFullscreenMedia
      ? "left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease"
      : undefined,
    borderColor: isFullscreenMedia ? "transparent" : undefined,
    ...shapeVisualStyle,
  };
}

/* ────────────────────── Action indicator badge ────────────────────────── */

interface ActionIndicatorProps {
  clickTooltip: string | undefined;
  hoverTooltip: string | undefined;
}

/** Small amber lightning-bolt badge shown when an element has an action. */
export function ActionIndicator({
  clickTooltip,
  hoverTooltip,
}: ActionIndicatorProps): React.ReactElement {
  return (
    <div
      className="absolute -top-1 -right-1 z-20 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center shadow"
      title={clickTooltip || hoverTooltip || "Has action"}
    >
      <svg
        className="w-2.5 h-2.5 text-white"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    </div>
  );
}
