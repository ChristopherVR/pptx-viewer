import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";

import { cn } from "../utils";
import { hasTextProperties } from "../../core";

// Extracted inspector modules
import {
  INSPECTOR_TABS as TABS,
  HEADING,
} from "./inspector/inspector-pane-constants";
import type { InspectorPaneProps } from "./inspector/inspector-pane-types";
import { ElementInspectorBody } from "./inspector/ElementInspectorBody";
import { InspectorCommentsSection } from "./inspector/InspectorCommentsSection";
import { PresentationPropertiesPanel } from "./inspector/PresentationPropertiesPanel";
import { SlideBackgroundPanel } from "./inspector/SlideBackgroundPanel";
import { AnimationPanel } from "./inspector/AnimationPanel";

// Re-exports for backward compatibility
export type { InspectorTab } from "./inspector/inspector-pane-types";
export type { ElementsTab } from "./inspector/ElementsTab";
export type { CommentsTab } from "./inspector/CommentsTab";
export type { SlideProperties } from "./inspector/SlideProperties";
export type { ElementProperties } from "./inspector/ElementProperties";
export type { TextProperties } from "./inspector/TextProperties";
export type { FillStrokeProperties } from "./inspector/FillStrokeProperties";
export type { AnimationPanel } from "./inspector/AnimationPanel";
export type { ChartDataPanel } from "./inspector/ChartDataPanel";

// ---------------------------------------------------------------------------
// Main Inspector Pane (thin shell — delegates to extracted sub-panels)
// ---------------------------------------------------------------------------

export function InspectorPane(props: InspectorPaneProps): React.ReactElement {
  const {
    isOpen,
    canEdit,
    activeSlide,
    slides,
    canvasSize,
    selectedElement,
    selectedElementIds,
    tableEditorState,
    activeTab,
    onSetActiveTab,
    onClose,
    onUpdateElement,
    onSelectElement,
    onMoveLayer,
    presentationProperties,
    onUpdatePresentationProperties,
    notesMaster,
    handoutMaster,
    notesCanvasSize,
    coreProperties,
    appProperties,
    customProperties,
    themeOptions,
    onUpdateCoreProperties,
    onUpdateAppProperties,
    onUpdateCustomProperties,
    tagCollections,
    onUpdateTagCollections,
    onApplyTheme,
    comments,
    commentDraft,
    editingCommentId,
    commentEditDraft,
    onSetCommentDraft,
    onAddComment,
    onDeleteComment,
    onStartEditComment,
    onSaveEditComment,
    onCancelEditComment,
    onSetCommentEditDraft,
    onToggleCommentResolved,
    onStartReply,
    onCancelReply,
    onReplyDraftChange,
    onSubmitReply,
    replyingToCommentId,
    replyDraftByCommentId,
    onUpdateCanvasSize,
    onUpdateElementStyle,
    onUpdateTextStyle,
    onUpdateSlide,
    editTemplateMode,
    slideMasters,
    onSetTemplateBackground,
    onGetTemplateBackgroundColor,
    mediaDataUrls,
    theme,
  } = props;
  const hasSelection = selectedElement !== null;
  const { t } = useTranslation();

  const [selectedThemePath, setSelectedThemePath] = useState<string>("");

  useEffect(() => {
    const activeThemePath = slideMasters?.[0]?.themePath;
    if (activeThemePath && activeThemePath.length > 0) {
      setSelectedThemePath(activeThemePath);
      return;
    }
    const fallback = themeOptions[0]?.path ?? "";
    setSelectedThemePath((previous) => previous || fallback);
  }, [slideMasters, themeOptions]);

  return (
    <div
      className={cn(
        "absolute top-0 right-0 h-full w-72 bg-background border-l border-border",
        "flex flex-col text-xs text-foreground shadow-xl z-20",
        "transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1 rounded bg-muted p-0.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              title={label}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors",
                activeTab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              onClick={() => onSetActiveTab(key)}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          title={t("common.close")}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <LuX className="w-4 h-4" />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* ── Elements ── */}
        {activeTab === "elements" && (
          <div className="space-y-1">
            <div className={cn(HEADING, "mb-2")}>
              {t("pptx.inspector.layerOrder")}
            </div>
            {activeSlide ? (
              [...(activeSlide.elements || [])].reverse().map((el, ri) => {
                const idx = (activeSlide.elements || []).length - 1 - ri;
                const sel =
                  selectedElement?.id === el.id ||
                  selectedElementIds.includes(el.id);
                const label =
                  (hasTextProperties(el)
                    ? (el.text || "").slice(0, 24)
                    : undefined) || el.type;
                return (
                  <div
                    key={el.id}
                    title={`${el.type} — ${el.id}`}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors",
                      sel
                        ? "bg-primary/30 text-primary"
                        : "hover:bg-muted text-foreground",
                    )}
                    onClick={() => onSelectElement(el.id)}
                  >
                    <span className="text-muted-foreground w-4 text-right">
                      {idx + 1}
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-muted-foreground italic">
                {t("pptx.inspector.noSlideSelected")}
              </div>
            )}
          </div>
        )}

        {/* ── Properties ── */}
        {activeTab === "properties" && (
          <div className="space-y-3">
            {hasSelection && selectedElement ? (
              <ElementInspectorBody
                selectedElement={selectedElement}
                canEdit={canEdit}
                slides={slides}
                tableEditorState={tableEditorState}
                mediaDataUrls={mediaDataUrls}
                onUpdateElement={onUpdateElement}
                onUpdateElementStyle={onUpdateElementStyle}
                onUpdateTextStyle={onUpdateTextStyle}
                onMoveLayer={onMoveLayer}
              />
            ) : (
              <>
                <PresentationPropertiesPanel
                  canEdit={canEdit}
                  canvasSize={canvasSize}
                  presentationProperties={presentationProperties}
                  onUpdatePresentationProperties={
                    onUpdatePresentationProperties
                  }
                  notesMaster={notesMaster}
                  handoutMaster={handoutMaster}
                  notesCanvasSize={notesCanvasSize}
                  coreProperties={coreProperties}
                  appProperties={appProperties}
                  customProperties={customProperties}
                  themeOptions={themeOptions}
                  selectedThemePath={selectedThemePath}
                  setSelectedThemePath={setSelectedThemePath}
                  onApplyTheme={onApplyTheme}
                  onUpdateCoreProperties={onUpdateCoreProperties}
                  onUpdateAppProperties={onUpdateAppProperties}
                  onUpdateCustomProperties={onUpdateCustomProperties}
                  tagCollections={tagCollections}
                  onUpdateTagCollections={onUpdateTagCollections}
                  onUpdateCanvasSize={onUpdateCanvasSize}
                  activeSlide={activeSlide}
                  theme={theme}
                  onUpdateSlide={onUpdateSlide}
                />

                {activeSlide && (
                  <SlideBackgroundPanel
                    activeSlide={activeSlide}
                    canEdit={canEdit}
                    onUpdateSlide={onUpdateSlide}
                    editTemplateMode={editTemplateMode}
                    slideMasters={slideMasters}
                    onSetTemplateBackground={onSetTemplateBackground}
                    onGetTemplateBackgroundColor={onGetTemplateBackgroundColor}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ── Comments ── */}
        {activeTab === "comments" && (
          <InspectorCommentsSection
            comments={comments}
            canEdit={canEdit}
            activeSlide={activeSlide}
            selectedElement={selectedElement}
            editingCommentId={editingCommentId}
            commentEditDraft={commentEditDraft}
            commentDraft={commentDraft}
            replyingToCommentId={replyingToCommentId ?? null}
            replyDraftByCommentId={replyDraftByCommentId ?? {}}
            onSetCommentDraft={onSetCommentDraft}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            onStartEditComment={onStartEditComment}
            onSaveEditComment={onSaveEditComment}
            onCancelEditComment={onCancelEditComment}
            onSetCommentEditDraft={onSetCommentEditDraft}
            onToggleCommentResolved={onToggleCommentResolved}
            onStartReply={onStartReply}
            onCancelReply={onCancelReply}
            onReplyDraftChange={onReplyDraftChange}
            onSubmitReply={onSubmitReply}
            onSelectElement={onSelectElement}
          />
        )}
      </div>

      {/* Animation panel — always visible at bottom when element selected */}
      {hasSelection && selectedElement && activeSlide && (
        <div className="border-t border-border p-3">
          <AnimationPanel
            selectedElement={selectedElement}
            activeSlide={activeSlide}
            canEdit={canEdit}
            onUpdateSlide={onUpdateSlide}
          />
        </div>
      )}
    </div>
  );
}
