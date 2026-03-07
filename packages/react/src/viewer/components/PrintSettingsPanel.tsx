/** PrintSettingsPanel — Settings form for the print dialog. */
import React from "react";
import { useTranslation } from "react-i18next";
import { LuFileText, LuGrid2X2, LuStickyNote, LuList } from "react-icons/lu";

import type {
  PrintWhat,
  PrintOrientation,
  PrintColorMode,
  HandoutSlidesPerPage,
  PrintSlideRange,
} from "./print-dialog-types";
import { HANDOUT_OPTIONS, radioClass } from "./print-dialog-types";

export interface PrintSettingsPanelProps {
  printWhat: PrintWhat;
  onPrintWhatChange: (value: PrintWhat) => void;
  orientation: PrintOrientation;
  onOrientationChange: (value: PrintOrientation) => void;
  colorMode: PrintColorMode;
  onColorModeChange: (value: PrintColorMode) => void;
  frameSlides: boolean;
  onFrameSlidesChange: (value: boolean) => void;
  slidesPerPage: HandoutSlidesPerPage;
  onSlidesPerPageChange: (value: HandoutSlidesPerPage) => void;
  slideRange: PrintSlideRange;
  onSlideRangeChange: (value: PrintSlideRange) => void;
  customFrom: number;
  onCustomFromChange: (value: number) => void;
  customTo: number;
  onCustomToChange: (value: number) => void;
  totalSlides: number;
  activeSlideIndex: number;
}

export function PrintSettingsPanel({
  printWhat,
  onPrintWhatChange,
  orientation,
  onOrientationChange,
  colorMode,
  onColorModeChange,
  frameSlides,
  onFrameSlidesChange,
  slidesPerPage,
  onSlidesPerPageChange,
  slideRange,
  onSlideRangeChange,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
  totalSlides,
  activeSlideIndex,
}: PrintSettingsPanelProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="flex-1 space-y-5 min-w-0">
      {/* Print What */}
      <fieldset>
        <legend className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          {t("pptx.print.printWhat")}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label className={radioClass(printWhat === "slides")}>
            <input
              type="radio"
              name="printWhat"
              className="sr-only"
              checked={printWhat === "slides"}
              onChange={() => onPrintWhatChange("slides")}
            />
            <LuFileText className="w-4 h-4 shrink-0" />
            {t("pptx.print.fullPageSlides")}
          </label>
          <label className={radioClass(printWhat === "handouts")}>
            <input
              type="radio"
              name="printWhat"
              className="sr-only"
              checked={printWhat === "handouts"}
              onChange={() => onPrintWhatChange("handouts")}
            />
            <LuGrid2X2 className="w-4 h-4 shrink-0" />
            {t("pptx.print.handouts")}
          </label>
          <label className={radioClass(printWhat === "notes")}>
            <input
              type="radio"
              name="printWhat"
              className="sr-only"
              checked={printWhat === "notes"}
              onChange={() => onPrintWhatChange("notes")}
            />
            <LuStickyNote className="w-4 h-4 shrink-0" />
            {t("pptx.print.notesPages")}
          </label>
          <label className={radioClass(printWhat === "outline")}>
            <input
              type="radio"
              name="printWhat"
              className="sr-only"
              checked={printWhat === "outline"}
              onChange={() => onPrintWhatChange("outline")}
            />
            <LuList className="w-4 h-4 shrink-0" />
            {t("pptx.print.outline")}
          </label>
        </div>
      </fieldset>

      {/* Handout options */}
      {printWhat === "handouts" && (
        <fieldset>
          <legend className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {t("pptx.print.slidesPerPage")}
          </legend>
          <div className="flex gap-1.5 flex-wrap">
            {HANDOUT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSlidesPerPageChange(n)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  slidesPerPage === n
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Slide Range */}
      <fieldset>
        <legend className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          {t("pptx.print.slideRange")}
        </legend>
        <div className="space-y-2">
          <label className={radioClass(slideRange === "all")}>
            <input
              type="radio"
              name="slideRange"
              className="sr-only"
              checked={slideRange === "all"}
              onChange={() => onSlideRangeChange("all")}
            />
            {t("pptx.print.allSlides")} ({totalSlides})
          </label>
          <label className={radioClass(slideRange === "current")}>
            <input
              type="radio"
              name="slideRange"
              className="sr-only"
              checked={slideRange === "current"}
              onChange={() => onSlideRangeChange("current")}
            />
            {t("pptx.print.currentSlide")} ({activeSlideIndex + 1})
          </label>
          <label className={radioClass(slideRange === "custom")}>
            <input
              type="radio"
              name="slideRange"
              className="sr-only"
              checked={slideRange === "custom"}
              onChange={() => onSlideRangeChange("custom")}
            />
            {t("pptx.print.customRange")}
          </label>
          {slideRange === "custom" && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-xs text-muted-foreground">
                {t("pptx.print.from")}
              </span>
              <input
                type="number"
                min={1}
                max={totalSlides}
                value={customFrom}
                onChange={(e) =>
                  onCustomFromChange(
                    Math.max(1, parseInt(e.target.value, 10) || 1),
                  )
                }
                className="w-16 px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
              />
              <span className="text-xs text-muted-foreground">
                {t("pptx.print.to")}
              </span>
              <input
                type="number"
                min={1}
                max={totalSlides}
                value={customTo}
                onChange={(e) =>
                  onCustomToChange(
                    Math.max(1, parseInt(e.target.value, 10) || 1),
                  )
                }
                className="w-16 px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
              />
            </div>
          )}
        </div>
      </fieldset>

      {/* Orientation — only for full-page slides */}
      {printWhat === "slides" && (
        <fieldset>
          <legend className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {t("pptx.print.orientation")}
          </legend>
          <div className="flex gap-2">
            <label className={radioClass(orientation === "landscape")}>
              <input
                type="radio"
                name="orientation"
                className="sr-only"
                checked={orientation === "landscape"}
                onChange={() => onOrientationChange("landscape")}
              />
              {t("pptx.print.landscape")}
            </label>
            <label className={radioClass(orientation === "portrait")}>
              <input
                type="radio"
                name="orientation"
                className="sr-only"
                checked={orientation === "portrait"}
                onChange={() => onOrientationChange("portrait")}
              />
              {t("pptx.print.portrait")}
            </label>
          </div>
        </fieldset>
      )}

      {/* Colour Mode */}
      <fieldset>
        <legend className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          {t("pptx.print.colorMode")}
        </legend>
        <div className="flex gap-2 flex-wrap">
          <label className={radioClass(colorMode === "color")}>
            <input
              type="radio"
              name="colorMode"
              className="sr-only"
              checked={colorMode === "color"}
              onChange={() => onColorModeChange("color")}
            />
            {t("pptx.print.color")}
          </label>
          <label className={radioClass(colorMode === "grayscale")}>
            <input
              type="radio"
              name="colorMode"
              className="sr-only"
              checked={colorMode === "grayscale"}
              onChange={() => onColorModeChange("grayscale")}
            />
            {t("pptx.print.grayscale")}
          </label>
          <label className={radioClass(colorMode === "blackAndWhite")}>
            <input
              type="radio"
              name="colorMode"
              className="sr-only"
              checked={colorMode === "blackAndWhite"}
              onChange={() => onColorModeChange("blackAndWhite")}
            />
            {t("pptx.print.blackAndWhite")}
          </label>
        </div>
      </fieldset>

      {/* Frame Slides */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={frameSlides}
          onChange={(e) => onFrameSlidesChange(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-sm text-foreground">
          {t("pptx.print.frameSlides")}
        </span>
      </label>
    </div>
  );
}
