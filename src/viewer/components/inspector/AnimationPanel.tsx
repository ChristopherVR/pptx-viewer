import React from "react";
import { useTranslation } from "react-i18next";
import { LuPlay } from "react-icons/lu";

import { cn } from "../../utils";
import type { PptxElement, PptxSlide } from "../../../core";
import { getElementLabel } from "../../utils";
import {
  INPUT_CLS,
  SELECT_CLS,
  ENTRANCE_PRESETS,
  EXIT_PRESETS,
  EMPHASIS_PRESETS,
  TRIGGER_OPTIONS,
  TIMING_CURVE_OPTIONS,
  REPEAT_MODE_OPTIONS,
  DIRECTION_OPTIONS,
  SEQUENCE_OPTIONS,
} from "./animation-panel-constants";
import { useAnimationHandlers } from "./useAnimationHandlers";
import { AnimationTimelineSection } from "./AnimationTimelineSection";

// ==========================================================================
// Props
// ==========================================================================

export interface AnimationPanelProps {
  selectedElement: PptxElement;
  activeSlide: PptxSlide;
  canEdit: boolean;
  onUpdateSlide: (updates: Partial<PptxSlide>) => void;
}

// ==========================================================================
// Component
// ==========================================================================

export function AnimationPanel({
  selectedElement,
  activeSlide,
  canEdit,
  onUpdateSlide,
}: AnimationPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const handlers = useAnimationHandlers({
    selectedElement,
    activeSlide,
    canEdit,
    onUpdateSlide,
  });
  const {
    selectedElementAnimation,
    hasAnimation,
    showDirectionPicker,
    handleEntranceChange,
    handleExitChange,
    handleEmphasisChange,
    handleTriggerChange,
    handleTriggerShapeChange,
    handleTimingCurveChange,
    handleDurationChange,
    handleDelayChange,
    handleRepeatCountChange,
    handleRepeatModeChange,
    handleDirectionChange,
    handleSequenceChange,
    handlePreviewClick,
  } = handlers;

  return (
    <div className="rounded border border-border bg-card p-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("pptx.animation.title")}
        </div>
        {hasAnimation && (
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
            onClick={handlePreviewClick}
            title={t("pptx.animation.preview")}
          >
            <LuPlay className="w-3 h-3" />
            {t("pptx.animation.preview")}
          </button>
        )}
      </div>

      {/* Entrance preset */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px]">
          {t("pptx.animation.entrance")}
        </span>
        <select
          value={selectedElementAnimation?.entrance ?? "none"}
          onChange={handleEntranceChange}
          disabled={!canEdit}
          className={SELECT_CLS}
        >
          <option value="none">{t("pptx.animation.none")}</option>
          {ENTRANCE_PRESETS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(`pptx.animation.preset.${o.value}`)}
            </option>
          ))}
        </select>
      </label>

      {/* Emphasis preset */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px]">
          {t("pptx.animation.emphasis")}
        </span>
        <select
          value={selectedElementAnimation?.emphasis ?? "none"}
          onChange={handleEmphasisChange}
          disabled={!canEdit}
          className={SELECT_CLS}
        >
          <option value="none">{t("pptx.animation.none")}</option>
          {EMPHASIS_PRESETS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(`pptx.animation.preset.${o.value}`)}
            </option>
          ))}
        </select>
      </label>

      {/* Exit preset */}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground text-[11px]">
          {t("pptx.animation.exit")}
        </span>
        <select
          value={selectedElementAnimation?.exit ?? "none"}
          onChange={handleExitChange}
          disabled={!canEdit}
          className={SELECT_CLS}
        >
          <option value="none">{t("pptx.animation.none")}</option>
          {EXIT_PRESETS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(`pptx.animation.preset.${o.value}`)}
            </option>
          ))}
        </select>
      </label>

      {/* Effect options — only show when an animation is set */}
      {hasAnimation && (
        <>
          {/* Direction picker */}
          {showDirectionPicker && (
            <div className="pt-1 border-t border-border">
              <span className="text-muted-foreground text-[11px] block mb-1">
                {t("pptx.animation.direction")}
              </span>
              <div className="flex gap-1">
                {DIRECTION_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive =
                    selectedElementAnimation?.direction === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!canEdit}
                      className={cn(
                        "flex items-center justify-center w-7 h-7 rounded border transition-colors",
                        isActive
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border bg-muted text-muted-foreground hover:bg-accent",
                      )}
                      onClick={() => handleDirectionChange(opt.value)}
                      title={t(opt.labelKey)}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sequence */}
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px]">
              {t("pptx.animation.sequence")}
            </span>
            <select
              value={selectedElementAnimation?.sequence ?? "asOne"}
              onChange={handleSequenceChange}
              disabled={!canEdit}
              className={SELECT_CLS}
            >
              {SEQUENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <div className="text-[11px] uppercase tracking-wide text-muted-foreground pt-1 border-t border-border">
            {t("pptx.animation.timing")}
          </div>

          {/* Trigger */}
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px]">
              {t("pptx.animation.trigger")}
            </span>
            <select
              value={selectedElementAnimation?.trigger ?? "onClick"}
              onChange={handleTriggerChange}
              disabled={!canEdit}
              className={SELECT_CLS}
            >
              {TRIGGER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </label>

          {/* Trigger Shape picker */}
          {selectedElementAnimation?.trigger === "onShapeClick" && (
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px]">
                {t("pptx.animation.trigger.shapeLabel")}
              </span>
              <select
                value={selectedElementAnimation?.triggerShapeId ?? ""}
                onChange={handleTriggerShapeChange}
                disabled={!canEdit}
                className={SELECT_CLS}
              >
                <option value="">
                  {t("pptx.animation.trigger.selectShape")}
                </option>
                {activeSlide.elements
                  .filter((el) => el.id !== selectedElement.id)
                  .map((el) => (
                    <option key={el.id} value={el.id}>
                      {getElementLabel(el)}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {/* Duration / Delay / Timing / Repeat */}
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px]">
              {t("pptx.animation.duration")}
            </span>
            <input
              type="number"
              min={100}
              max={10000}
              step={50}
              disabled={!canEdit}
              value={selectedElementAnimation?.durationMs ?? 450}
              onChange={handleDurationChange}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px]">
              {t("pptx.animation.delay")}
            </span>
            <input
              type="number"
              min={0}
              max={10000}
              step={50}
              disabled={!canEdit}
              value={selectedElementAnimation?.delayMs ?? 0}
              onChange={handleDelayChange}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px]">
              {t("pptx.animation.timingCurve")}
            </span>
            <select
              value={selectedElementAnimation?.timingCurve ?? "ease"}
              onChange={handleTimingCurveChange}
              disabled={!canEdit}
              className={SELECT_CLS}
            >
              {TIMING_CURVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px]">
              {t("pptx.animation.repeatCount")}
            </span>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              disabled={!canEdit}
              value={selectedElementAnimation?.repeatCount ?? 1}
              onChange={handleRepeatCountChange}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-[11px]">
              {t("pptx.animation.repeatUntil")}
            </span>
            <select
              value={selectedElementAnimation?.repeatMode ?? "none"}
              onChange={handleRepeatModeChange}
              disabled={!canEdit}
              className={SELECT_CLS}
            >
              {REPEAT_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {/* Timeline sections */}
      <AnimationTimelineSection
        selectedElementId={selectedElement.id}
        canEdit={canEdit}
        handlers={handlers}
      />
    </div>
  );
}
