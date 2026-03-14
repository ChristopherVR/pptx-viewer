import React from "react";
import { cn } from "../utils";
import { TOOLBAR_SECTIONS } from "../constants";
import { ToolbarPrimaryRow } from "./toolbar/ToolbarPrimaryRow";
import { InsertSection } from "./toolbar/InsertSection";
import { TextSection } from "./toolbar/TextSection";
import { DrawSection } from "./toolbar/DrawSection";
import { ArrangeSection } from "./toolbar/ArrangeSection";
import {
  DesignSection,
  TransitionsSection,
  ReviewSection,
} from "./toolbar/DesignTransitionsReviewSection";
import { ViewSection } from "./toolbar/ViewSection";

export type { ToolbarProps } from "./toolbar/toolbar-types";

import type { ToolbarProps } from "./toolbar/toolbar-types";

export function Toolbar(p: ToolbarProps): React.ReactElement {
  const {
    mode,
    isNarrowViewport,
    isCompactToolbarOpen,
    toolbarSection,
    onSetToolbarSection,
  } = p;

  const sIns = toolbarSection === "home" || toolbarSection === "insert";
  const sTxt = toolbarSection === "text";
  const sArr = toolbarSection === "arrange";
  const sDrw = toolbarSection === "draw";
  const sDes = toolbarSection === "design";
  const sTrn = toolbarSection === "transitions";
  const sRev = toolbarSection === "review";
  const sViw = toolbarSection === "view";

  return (
    <div
      role="toolbar"
      aria-label="Presentation toolbar"
      className="relative z-20 px-2 py-1.5 border-b border-border bg-background shadow-[0_4px_12px_rgba(0,0,0,0.3)] overflow-visible"
    >
      {/* Primary Row */}
      <ToolbarPrimaryRow {...p} />

      {/* Contextual Ribbon */}
      {(mode === "edit" || mode === "master") && (
        <div
          className={cn(
            "flex items-center gap-1.5 flex-wrap mt-1.5",
            isNarrowViewport && !isCompactToolbarOpen && "hidden",
          )}
        >
          <div className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 p-0.5 text-[11px]">
            {TOOLBAR_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSetToolbarSection(s.id)}
                className={cn(
                  "rounded px-2 py-0.5 transition-colors",
                  toolbarSection === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {sIns && (
            <InsertSection
              canEdit={p.canEdit}
              newShapeType={p.newShapeType}
              onSetNewShapeType={p.onSetNewShapeType}
              onAddTextBox={p.onAddTextBox}
              onAddShape={p.onAddShape}
              onAddTable={p.onAddTable}
              onAddSmartArt={p.onAddSmartArt}
              onAddEquation={p.onAddEquation}
              onAddActionButton={p.onAddActionButton}
              onInsertField={p.onInsertField}
              onOpenImagePicker={p.onOpenImagePicker}
              onOpenMediaPicker={p.onOpenMediaPicker}
            />
          )}

          {sTxt && (
            <TextSection
              canEdit={p.canEdit}
              selectedElement={p.selectedElement}
              onUpdateTextStyle={p.onUpdateTextStyle}
            />
          )}

          {sDrw && (
            <DrawSection
              activeTool={p.activeTool}
              drawingColor={p.drawingColor}
              drawingWidth={p.drawingWidth}
              onSetActiveTool={p.onSetActiveTool}
              onSetDrawingColor={p.onSetDrawingColor}
              onSetDrawingWidth={p.onSetDrawingWidth}
            />
          )}

          {sArr && (
            <ArrangeSection
              canEdit={p.canEdit}
              selectedElement={p.selectedElement}
              clipboardPayload={p.clipboardPayload}
              onAlignElements={p.onAlignElements}
              onCopy={p.onCopy}
              onCut={p.onCut}
              onPaste={p.onPaste}
              onFlip={p.onFlip}
              onMoveLayer={p.onMoveLayer}
              onMoveLayerToEdge={p.onMoveLayerToEdge}
              onDuplicate={p.onDuplicate}
              onDelete={p.onDelete}
              formatPainterActive={p.formatPainterActive}
              onToggleFormatPainter={p.onToggleFormatPainter}
            />
          )}

          {sDes && (
            <DesignSection
              canEdit={p.canEdit}
              onToggleThemeGallery={p.onToggleThemeGallery}
              isThemeGalleryOpen={p.isThemeGalleryOpen}
              onToggleThemeEditor={p.onToggleThemeEditor}
              isThemeEditorOpen={p.isThemeEditorOpen}
            />
          )}

          {sTrn && (
            <TransitionsSection
              isInspectorPaneOpen={p.isInspectorPaneOpen}
              onToggleInspector={p.onToggleInspector}
            />
          )}

          {sRev && (
            <ReviewSection
              canEdit={p.canEdit}
              spellCheckEnabled={p.spellCheckEnabled}
              onSetSpellCheckEnabled={p.onSetSpellCheckEnabled}
              onToggleComments={p.onToggleComments}
              isCommentsPanelOpen={p.isCommentsPanelOpen}
              slideCommentCount={p.slideCommentCount}
              onCompare={p.onCompare}
            />
          )}

          {sViw && (
            <ViewSection
              canEdit={p.canEdit}
              editTemplateMode={p.editTemplateMode}
              onSetEditTemplateMode={p.onSetEditTemplateMode}
              spellCheckEnabled={p.spellCheckEnabled}
              onSetSpellCheckEnabled={p.onSetSpellCheckEnabled}
              showGrid={p.showGrid}
              showRulers={p.showRulers}
              snapToGrid={p.snapToGrid}
              snapToShape={p.snapToShape}
              onSetShowGrid={p.onSetShowGrid}
              onSetShowRulers={p.onSetShowRulers}
              onSetSnapToGrid={p.onSetSnapToGrid}
              onSetSnapToShape={p.onSetSnapToShape}
              onAddGuide={p.onAddGuide}
              onEnterMasterView={p.onEnterMasterView}
              isSelectionPaneOpen={p.isSelectionPaneOpen}
              onToggleSelectionPane={p.onToggleSelectionPane}
              eyedropperActive={p.eyedropperActive}
              onToggleEyedropper={p.onToggleEyedropper}
            />
          )}
        </div>
      )}
    </div>
  );
}
