import React, { useState, useCallback } from "react";
import type { PptxElement } from "pptx-viewer-core";
import {
  hasShapeProperties,
  hasTextProperties,
} from "pptx-viewer-core";
import { cn } from "../utils";
import {
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_COLOR,
  DEFAULT_TEXT_COLOR,
} from "../constants";
import type { TableCellEditorState } from "../types";
import {
  buildCssGradientFromShapeStyle,
  getImageEffectsFilter,
  getImageEffectsOpacity,
  getImageRenderStyle,
  getShapeVisualStyle,
  getTextStyleForElement,
  isConnectorOrLineElement,
  isEditableTextElement,
  normalizeHexColor,
  renderVectorShape,
} from "../utils";
import { getAriaRole, getAriaLabel, getAriaRoleDescription } from "../utils/accessibility";
import { ConnectorElementRenderer } from "./elements/ConnectorElementRenderer";
import { renderBody } from "./elements/ElementBody";
import { ResizeHandles } from "./elements/ResizeHandles";
import {
  renderDagDuotoneFilterForElement,
  getContainerStyle,
  ActionIndicator,
} from "./elements/element-renderer-helpers";
export type { ElementRendererProps } from "./elements/element-renderer-types";
import type { ElementRendererProps } from "./elements/element-renderer-types";

export function shapeParams(el: PptxElement) {
  const ss = hasShapeProperties(el) ? el.shapeStyle : undefined;
  const sw = Math.max(0, ss?.strokeWidth || 0);
  const sc = normalizeHexColor(ss?.strokeColor, DEFAULT_STROKE_COLOR);
  const fc = normalizeHexColor(ss?.fillColor, DEFAULT_FILL_COLOR);
  const hf =
    (ss?.fillColor !== undefined && ss?.fillColor !== "transparent") ||
    Boolean(buildCssGradientFromShapeStyle(ss) || ss?.fillGradient) ||
    (ss?.fillMode === "pattern" && Boolean(ss.fillPatternPreset));
  return { hf, fc, sw, sc } as const;
}

export const ElementRenderer: React.FC<ElementRendererProps> = React.memo(
  function ElementRendererInner({
    element: el,
    activeSlide,
    isSelected,
    isInlineEditing,
    inlineEditingText,
    canInteract,
    spellCheckEnabled,
    mediaDataUrls,
    tableEditorState,
    selectionColorClass: selClr,
    showHoverBorder,
    opacity,
    zIndex,
    imageAltText,
    showResizeHandles,
    renderInk: doInk,
    renderGroups: doGrp,
    adjustmentHandleDescriptor: adjH,
    onResizePointerDown,
    onAdjustmentPointerDown,
    onInlineEditChange,
    onInlineEditCommit,
    onInlineEditCancel,
    onTableCellSelect,
    onCommitCellEdit,
    onResizeTableColumns,
    onResizeTableRow,
    findHighlights,
    onActionClick,
    onHyperlinkClick,
    animationState,
    presentationElementStates,
    allSlides,
    onZoomClick,
    sourceSlideIndex,
    fieldContext,
  }) {
    // Create element-scoped table cell select handler
    const cellSelectHandler = onTableCellSelect
      ? (cell: TableCellEditorState | null) => onTableCellSelect(cell, el.id)
      : undefined;
    // Create element-scoped cell edit commit handler
    const cellCommitHandler = onCommitCellEdit
      ? (rowIndex: number, colIndex: number, text: string) =>
          onCommitCellEdit(el.id, rowIndex, colIndex, text)
      : undefined;
    // Create element-scoped column / row resize handlers
    const colResizeHandler = onResizeTableColumns
      ? (newWidths: number[]) => onResizeTableColumns(el.id, newWidths)
      : undefined;
    const rowResizeHandler = onResizeTableRow
      ? (rowIndex: number, newHeight: number) =>
          onResizeTableRow(el.id, rowIndex, newHeight)
      : undefined;
    const { hf, fc, sw, sc } = shapeParams(el);
    const elementLocks = el.locks;
    const isTxt = isEditableTextElement(el) && !elementLocks?.noTextEdit;
    const txtSE = hasTextProperties(el) ? el.textStyle : undefined;
    const ss = getShapeVisualStyle(el, hf, fc, sw, sc);
    const ts = getTextStyleForElement(el, DEFAULT_TEXT_COLOR);
    const vs = renderVectorShape(el, hf, fc, sw, sc);
    const isImg = el.type === "picture" || el.type === "image";
    const isModel3D = el.type === "model3d";
    const isConn = isConnectorOrLineElement(el);

    // ── Full-screen media play state tracking ──
    const [isMediaPlaying, setIsMediaPlaying] = useState(false);
    const handleMediaPlayStateChange = useCallback((playing: boolean): void => {
      setIsMediaPlaying(playing);
    }, []);

    // ── Connector / line elements get specialised SVG-based rendering ──
    if (isConn) {
      return (
        <ConnectorElementRenderer
          el={el}
          isSelected={isSelected}
          canInteract={canInteract}
          showResizeHandles={showResizeHandles && !elementLocks?.noResize}
          showHoverBorder={showHoverBorder}
          selectionColorClass={selClr}
          opacity={opacity}
          zIndex={zIndex}
          adjustmentHandleDescriptor={adjH}
          onResizePointerDown={onResizePointerDown}
          onAdjustmentPointerDown={onAdjustmentPointerDown}
          animationState={animationState}
        />
      );
    }

    const effectiveCanInteract = canInteract && !elementLocks?.noSelect;
    const effectiveShowResizeHandles =
      showResizeHandles && !elementLocks?.noResize;
    const effectiveIsInlineEditing =
      isInlineEditing && !elementLocks?.noTextEdit;

    // Elements with actions or hyperlinks should be clickable even when not
    // in editing mode (e.g. during presentation mode).
    const hasAction = Boolean(el.actionClick && onActionClick);
    const hasHoverAction = Boolean(el.actionHover);
    const hasHyperlinks = Boolean(onHyperlinkClick);
    const isZoom = el.type === "zoom" && Boolean(onZoomClick);
    const isActionable = hasAction || hasHoverAction || hasHyperlinks || isZoom;

    const selB = isSelected
      ? `border-${selClr} ring-2 ring-${selClr}/50`
      : showHoverBorder
        ? "border-transparent hover:border-primary/40"
        : "border-transparent";
    const cur = effectiveIsInlineEditing
      ? "cursor-text"
      : effectiveCanInteract
        ? elementLocks?.noMove
          ? "cursor-default"
          : "cursor-move"
        : hasAction || isZoom
          ? "cursor-pointer"
          : "";

    const isPresentationPassive = !effectiveCanInteract;
    const isFullscreenMedia =
      el.type === "media" &&
      Boolean(el.fullScreen) &&
      isPresentationPassive &&
      isMediaPlaying;

    // Accessibility attributes
    const ariaRole = getAriaRole(el);
    const ariaLabel = getAriaLabel(el);
    const ariaRoleDescription = getAriaRoleDescription(el);
    const isFocusable = effectiveCanInteract || isActionable;

    return (
      <div
        data-pptx-element="true"
        data-element-id={el.id}
        role={ariaRole}
        aria-label={ariaLabel}
        aria-roledescription={ariaRoleDescription}
        aria-selected={isSelected ? true : undefined}
        tabIndex={isFocusable ? 0 : -1}
        className={cn(
          "absolute border",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
          cur,
          effectiveCanInteract || isActionable ? "" : "pointer-events-none",
          isFullscreenMedia ? "pointer-events-auto" : "",
          selB,
        )}
        style={getContainerStyle({
          el,
          isFullscreenMedia,
          isImg: isImg || isModel3D,
          zIndex,
          opacity,
          animationState,
          shapeVisualStyle: ss,
        })}
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            isTxt &&
            effectiveCanInteract &&
            !effectiveIsInlineEditing
          ) {
            // Start inline editing on Enter
            e.preventDefault();
            e.stopPropagation();
            const dblClickEvt = new MouseEvent("dblclick", { bubbles: true });
            e.currentTarget.dispatchEvent(dblClickEvt);
          } else if (e.key === "Escape" && effectiveIsInlineEditing) {
            // Exit inline editing on Escape
            e.preventDefault();
            e.stopPropagation();
            onInlineEditCancel();
          }
        }}
        onClick={(e) => {
          if (!effectiveCanInteract && el.actionClick && onActionClick) {
            e.stopPropagation();
            if (el.actionClick.highlightClick) {
              const target = e.currentTarget;
              target.style.filter = "brightness(1.18)";
              target.style.outline = "2px solid rgba(59, 130, 246, 0.6)";
              window.setTimeout(() => {
                target.style.filter = "";
                target.style.outline = "";
              }, 320);
            }
            onActionClick(el.id, el.actionClick);
          }
        }}
        onMouseEnter={(e) => {
          if (hasHoverAction && el.actionHover?.highlightClick) {
            const target = e.currentTarget;
            target.style.filter = "brightness(1.15)";
            target.style.outline = "2px solid rgba(59, 130, 246, 0.5)";
          }
          if (
            isPresentationPassive &&
            el.actionHover &&
            onActionClick &&
            (el.actionHover.url ||
              el.actionHover.targetSlideIndex !== undefined)
          ) {
            onActionClick(el.id, el.actionHover);
          }
        }}
        onMouseLeave={
          hasHoverAction && el.actionHover?.highlightClick
            ? (e) => {
                const target = e.currentTarget;
                target.style.filter = "";
                target.style.outline = "";
              }
            : undefined
        }
        title={el.actionClick?.tooltip || el.actionHover?.tooltip || undefined}
      >
        {renderDagDuotoneFilterForElement(el)}
        {renderBody(
          el,
          isImg,
          effectiveIsInlineEditing,
          inlineEditingText,
          spellCheckEnabled,
          txtSE,
          ts,
          vs,
          getImageRenderStyle(el),
          getImageEffectsFilter(el),
          getImageEffectsOpacity(el),
          imageAltText,
          isTxt,
          mediaDataUrls,
          tableEditorState,
          isSelected,
          doInk,
          doGrp,
          onInlineEditChange,
          onInlineEditCommit,
          onInlineEditCancel,
          cellSelectHandler,
          cellCommitHandler,
          colResizeHandler,
          rowResizeHandler,
          findHighlights,
          onHyperlinkClick,
          isPresentationPassive,
          handleMediaPlayStateChange,
          presentationElementStates,
          activeSlide?.elements,
          allSlides,
          onZoomClick,
          sourceSlideIndex,
          fieldContext,
        )}
        {(el.actionClick || el.actionHover) && canInteract && (
          <ActionIndicator
            clickTooltip={el.actionClick?.tooltip}
            hoverTooltip={el.actionHover?.tooltip}
          />
        )}
        {effectiveShowResizeHandles && !effectiveIsInlineEditing && (
          <ResizeHandles
            elementId={el.id}
            adjustmentHandleDescriptor={adjH}
            onResizePointerDown={onResizePointerDown}
            onAdjustmentPointerDown={onAdjustmentPointerDown}
          />
        )}
      </div>
    );
  },
);
