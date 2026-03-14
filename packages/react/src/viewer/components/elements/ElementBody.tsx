import React from "react";
import type {
  ContentPartPptxElement,
  GroupPptxElement,
  Model3DPptxElement,
  OlePptxElement,
  PptxElement,
  TextStyle,
} from "pptx-viewer-core";
import { hasTextProperties, isInkElement, getLinkedTextBoxSegments } from "pptx-viewer-core";
import { Model3DRenderer } from "./Model3DRenderer";
import { cn } from "../../utils";
import { DEFAULT_TEXT_COLOR } from "../../constants";
import type { TableCellEditorState } from "../../types";
import {
  getTextCompensationTransform,
  getTextLayoutStyle,
  getTextWarpStyle,
  renderChartElement,
  renderMediaElement,
  renderSmartArtElement,
  renderTableElement,
  renderTextSegments,
  shouldRenderFallbackLabel,
  getElementLabel,
} from "../../utils";
import type { ElementFindHighlights } from "../../utils/text-render";
import type { ElementAnimationState } from "../../utils/animation-timeline";
import { shouldUseSvgWarp } from "../../utils/text-warp";
import { WarpedText } from "../../utils/text-warp";
import { renderImg } from "./ImageRenderer";
import { InlineTextEditor } from "./InlineTextEditor";
import {
  renderInk,
  renderGroup,
  renderContentPart,
  renderOleElement,
} from "./InkGroupRenderers";

export function renderBody(
  el: PptxElement,
  isImg: boolean,
  isEditing: boolean,
  editText: string,
  spellCheck: boolean,
  txtSE: TextStyle | undefined,
  txtS: React.CSSProperties,
  vecShape: React.ReactNode,
  imgStyle: React.CSSProperties,
  imgFilter: string | undefined,
  imgOpacity: number | undefined,
  imgAlt: string,
  isTxtEl: boolean,
  media: Map<string, string>,
  tableSt: TableCellEditorState | null | undefined,
  isSel: boolean,
  doInk: boolean,
  doGrp: boolean,
  onEditChange: (t: string) => void,
  onCommit: () => void,
  onCancel: () => void,
  onCellSel?: (c: TableCellEditorState | null) => void,
  onCellCommit?: (rowIndex: number, colIndex: number, text: string) => void,
  onColResize?: (newWidths: number[]) => void,
  onRowResize?: (rowIndex: number, newHeight: number) => void,
  findHl?: ElementFindHighlights,
  onHyperlinkClick?: (url: string) => void,
  isPresentationPassive?: boolean,
  handleMediaPlayStateChange?: (isPlaying: boolean) => void,
  presentationElementStates?: ReadonlyMap<string, ElementAnimationState>,
  /** All elements on the current slide, used for linked text box overflow distribution. */
  slideElements?: readonly PptxElement[],
): React.ReactNode {
  if (el.type === "model3d") {
    return (
      <Model3DRenderer
        element={el as Model3DPptxElement}
        width={el.width}
        height={el.height}
        interactive={!isPresentationPassive}
      />
    );
  }
  if (isImg) return renderImg(el, imgStyle, imgFilter, imgAlt, imgOpacity);
  if (isEditing)
    return (
      <>
        {vecShape}
        <InlineTextEditor
          initialText={editText}
          spellCheck={spellCheck}
          rtl={txtSE?.rtl}
          textDirection={txtSE?.textDirection}
          textStyle={txtS}
          textStyleRaw={txtSE}
          layoutStyle={getTextLayoutStyle(el)}
          element={el}
          onCommit={onCommit}
          onCancel={onCancel}
          onEditChange={onEditChange}
        />
      </>
    );
  if (el.type === "table")
    return renderTableElement(el, txtS, {
      editable: isSel,
      selectedCell: isSel ? tableSt : null,
      onSelectCell: onCellSel,
      onCommitCellEdit: onCellCommit,
      onResizeColumns: onColResize,
      onResizeRow: onRowResize,
    });
  if (el.type === "chart") return renderChartElement(el);
  if (el.type === "smartArt") return renderSmartArtElement(el);
  if (el.type === "media") {
    return renderMediaElement(el, media, {
      autoPlay: isPresentationPassive,
      fullScreen: isPresentationPassive && Boolean(el.fullScreen),
      isPresentationMode: isPresentationPassive,
      onPlayStateChange: handleMediaPlayStateChange,
    });
  }
  if (doInk && isInkElement(el)) return renderInk(el);
  if (el.type === "contentPart")
    return renderContentPart(el as ContentPartPptxElement);
  if (el.type === "ole") return renderOleElement(el as OlePptxElement);
  if (doGrp && el.type === "group" && (el as GroupPptxElement).children)
    return renderGroup((el as GroupPptxElement).children);
  if (shouldRenderFallbackLabel(el, isTxtEl))
    return (
      <div className="w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none">
        {getElementLabel(el)}
      </div>
    );

  // Linked text box chain: clip overflow so text does not spill beyond the frame.
  const isLinkedTxbx = hasTextProperties(el) && el.linkedTxbxId !== undefined;
  const linkedOverflowCss: React.CSSProperties = isLinkedTxbx
    ? { overflow: "hidden" }
    : {};

  // Compute distributed text segments for linked text box chains.
  // When an element belongs to a chain, getLinkedTextBoxSegments returns the
  // slice of text that should render in this particular box after overflow
  // distribution. For non-linked elements this is undefined and rendering
  // falls back to the element's own textSegments.
  const linkedSegments =
    isLinkedTxbx && slideElements
      ? getLinkedTextBoxSegments(el, slideElements)
      : undefined;

  // Determine if the element should use SVG textPath-based warp rendering.
  const warpPreset = hasTextProperties(el) ? el.textStyle?.textWarpPreset : undefined;
  const useSvgWarp = shouldUseSvgWarp(warpPreset);

  return (
    <>
      {vecShape}
      {isTxtEl ? (
        useSvgWarp ? (
          <div
            className={cn(
              "relative z-10 w-full h-full",
              onHyperlinkClick ? "" : "pointer-events-none",
            )}
            style={{
              ...getTextLayoutStyle(el),
              transform: getTextCompensationTransform(el),
              transformOrigin: "center",
              ...linkedOverflowCss,
            }}
          >
            <WarpedText
              element={el}
              width={el.width}
              height={el.height}
              fallbackColor={DEFAULT_TEXT_COLOR}
              findHighlights={findHl}
            />
          </div>
        ) : (
          <div
            className={cn(
              "relative z-10 w-full h-full whitespace-pre-wrap break-words leading-[1.3]",
              onHyperlinkClick ? "" : "pointer-events-none",
            )}
            style={{
              ...getTextLayoutStyle(el),
              ...txtS,
              ...getTextWarpStyle(txtSE),
              transform: getTextCompensationTransform(el),
              transformOrigin: "center",
              ...linkedOverflowCss,
            }}
          >
            {renderTextSegments(
              el,
              DEFAULT_TEXT_COLOR,
              undefined,
              findHl,
              onHyperlinkClick,
              undefined,
              presentationElementStates,
              linkedSegments ?? undefined,
            )}
          </div>
        )
      ) : hasTextProperties(el) && el.promptText ? (
        useSvgWarp ? (
          <div
            className={cn(
              "relative z-10 w-full h-full",
              onHyperlinkClick ? "" : "pointer-events-none",
            )}
            style={{
              ...getTextLayoutStyle(el),
              transform: getTextCompensationTransform(el),
              transformOrigin: "center",
              ...linkedOverflowCss,
            }}
          >
            <WarpedText
              element={el}
              width={el.width}
              height={el.height}
              fallbackColor={DEFAULT_TEXT_COLOR}
              findHighlights={findHl}
            />
          </div>
        ) : (
          <div
            className={cn(
              "relative z-10 w-full h-full whitespace-pre-wrap break-words leading-[1.3]",
              onHyperlinkClick ? "" : "pointer-events-none",
            )}
            style={{
              ...getTextLayoutStyle(el),
              ...txtS,
              ...getTextWarpStyle(txtSE),
              transform: getTextCompensationTransform(el),
              transformOrigin: "center",
              ...linkedOverflowCss,
            }}
          >
            {renderTextSegments(
              el,
              DEFAULT_TEXT_COLOR,
              undefined,
              findHl,
              onHyperlinkClick,
              undefined,
              presentationElementStates,
              linkedSegments ?? undefined,
            )}
          </div>
        )
      ) : null}
    </>
  );
}
