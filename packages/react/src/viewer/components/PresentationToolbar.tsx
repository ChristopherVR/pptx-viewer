/**
 * PresentationToolbar
 *
 * Floating bottom toolbar shown during presentation mode.
 * Appears on mouse movement and fades out after 3 seconds of inactivity.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LuPenTool,
  LuHighlighter,
  LuEraser,
  LuTrash2,
  LuMousePointer2,
} from "react-icons/lu";

import type { PresentationTool } from "../hooks/usePresentationAnnotations";

// ---------------------------------------------------------------------------
// Color picker presets
// ---------------------------------------------------------------------------

const PEN_COLORS = [
  "#ff0000",
  "#0000ff",
  "#00aa00",
  "#ff8800",
  "#ffffff",
  "#000000",
  "#ff00ff",
  "#00cccc",
];

const HIGHLIGHTER_COLORS = [
  "#ffff00",
  "#00ff00",
  "#ff69b4",
  "#00bfff",
  "#ff8c00",
  "#adff2f",
  "#ff6347",
  "#87ceeb",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PresentationToolbarProps {
  presentationTool: PresentationTool;
  penColor: string;
  highlighterColor: string;
  hasAnnotations: boolean;
  onSetTool: (tool: PresentationTool) => void;
  onSetPenColor: (color: string) => void;
  onSetHighlighterColor: (color: string) => void;
  onClearAnnotations: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationToolbar({
  presentationTool,
  penColor,
  highlighterColor,
  hasAnnotations,
  onSetTool,
  onSetPenColor,
  onSetHighlighterColor,
  onClearAnnotations,
}: PresentationToolbarProps): React.ReactElement {
  const { t } = useTranslation();
  const [showPenColors, setShowPenColors] = useState(false);
  const [showHighlighterColors, setShowHighlighterColors] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close color pickers when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        setShowPenColors(false);
        setShowHighlighterColors(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleToolClick = useCallback(
    (tool: PresentationTool) => {
      onSetTool(tool);
      setShowPenColors(false);
      setShowHighlighterColors(false);
    },
    [onSetTool],
  );

  const handlePenRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowPenColors((prev) => !prev);
    setShowHighlighterColors(false);
  }, []);

  const handleHighlighterRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowHighlighterColors((prev) => !prev);
    setShowPenColors(false);
  }, []);

  const toolBtnClass = (tool: PresentationTool): string =>
    `flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
      presentationTool === tool
        ? "bg-white/25 text-white"
        : "text-white/70 hover:text-white hover:bg-white/10"
    }`;

  return (
    <div
      ref={toolbarRef}
      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-background/80 backdrop-blur-sm border border-white/10 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Laser pointer */}
      <button
        type="button"
        className={toolBtnClass("laser")}
        onClick={() => handleToolClick("laser")}
        title={t("pptx.presentation.laserPointer")}
      >
        <LuMousePointer2 size={18} />
      </button>

      {/* Pen */}
      <div className="relative">
        <button
          type="button"
          className={toolBtnClass("pen")}
          onClick={() => handleToolClick("pen")}
          onContextMenu={handlePenRightClick}
          title={t("pptx.presentation.pen")}
        >
          <LuPenTool size={18} />
          <div
            className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full"
            style={{ backgroundColor: penColor }}
          />
        </button>
        {showPenColors && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover rounded-lg border border-white/10 grid grid-cols-4 gap-1">
            {PEN_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  penColor === color ? "border-white" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  onSetPenColor(color);
                  setShowPenColors(false);
                  if (presentationTool !== "pen") onSetTool("pen");
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Highlighter */}
      <div className="relative">
        <button
          type="button"
          className={toolBtnClass("highlighter")}
          onClick={() => handleToolClick("highlighter")}
          onContextMenu={handleHighlighterRightClick}
          title={t("pptx.presentation.highlighter")}
        >
          <LuHighlighter size={18} />
          <div
            className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full"
            style={{ backgroundColor: highlighterColor }}
          />
        </button>
        {showHighlighterColors && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-popover rounded-lg border border-white/10 grid grid-cols-4 gap-1">
            {HIGHLIGHTER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  highlighterColor === color
                    ? "border-white"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  onSetHighlighterColor(color);
                  setShowHighlighterColors(false);
                  if (presentationTool !== "highlighter")
                    onSetTool("highlighter");
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Eraser */}
      <button
        type="button"
        className={toolBtnClass("eraser")}
        onClick={() => handleToolClick("eraser")}
        title={t("pptx.presentation.eraser")}
      >
        <LuEraser size={18} />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-white/20 mx-1" />

      {/* Clear all */}
      <button
        type="button"
        className={`flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
          hasAnnotations
            ? "text-white/70 hover:text-red-400 hover:bg-white/10"
            : "text-white/30 cursor-not-allowed"
        }`}
        onClick={hasAnnotations ? onClearAnnotations : undefined}
        title={t("pptx.presentation.clearAnnotations")}
        disabled={!hasAnnotations}
      >
        <LuTrash2 size={18} />
      </button>
    </div>
  );
}
