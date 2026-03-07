import React, { useState, useCallback } from "react";
import { LuPlus, LuTrash2, LuBookmark } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import type {
  MediaPptxElement,
  MediaBookmark,
  PptxElement,
} from "pptx-viewer-core";
import {
  CARD,
  HEADING,
  INPUT,
  BTN,
  LABEL_CLS,
  LABEL_TEXT,
  formatTime,
  generateBookmarkId,
} from "./TrimTimeline";

// ==========================================================================
// Props
// ==========================================================================

interface MediaPlaybackBookmarksProps {
  element: MediaPptxElement;
  canEdit: boolean;
  currentTime: number;
  bookmarks: MediaBookmark[];
  onUpdateElement: (updates: Partial<PptxElement>) => void;
  onSeekTo: (time: number) => void;
}

// ==========================================================================
// Component
// ==========================================================================

export function MediaPlaybackBookmarks({
  element,
  canEdit,
  currentTime,
  bookmarks,
  onUpdateElement,
  onSeekTo,
}: MediaPlaybackBookmarksProps): React.ReactElement {
  const { t } = useTranslation();
  const [newBookmarkLabel, setNewBookmarkLabel] = useState("");

  const volumePercent = Math.round((element.volume ?? 1) * 100);

  const handleAddBookmark = useCallback((): void => {
    const label =
      newBookmarkLabel.trim() ||
      `${t("pptx.media.bookmark")} ${bookmarks.length + 1}`;
    const newBmk: MediaBookmark = {
      id: generateBookmarkId(),
      time: currentTime,
      label,
    };
    onUpdateElement({
      bookmarks: [...bookmarks, newBmk],
    } as Partial<PptxElement>);
    setNewBookmarkLabel("");
  }, [bookmarks, currentTime, newBookmarkLabel, onUpdateElement, t]);

  const handleRemoveBookmark = useCallback(
    (bmkId: string): void => {
      onUpdateElement({
        bookmarks: bookmarks.filter((b) => b.id !== bmkId),
      } as Partial<PptxElement>);
    },
    [bookmarks, onUpdateElement],
  );

  return (
    <>
      {/* ── Playback settings ── */}
      <div className={CARD}>
        <div className={HEADING}>{t("pptx.media.playback")}</div>

        {/* Volume */}
        <label className={LABEL_CLS}>
          <span className={`text-[11px] ${LABEL_TEXT}`}>
            {t("pptx.media.volume")}
          </span>
          <div className="flex items-center gap-1 flex-1 max-w-[140px]">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              disabled={!canEdit}
              className="flex-1"
              value={volumePercent}
              onChange={(e) =>
                onUpdateElement({
                  volume: Number(e.target.value) / 100,
                } as Partial<PptxElement>)
              }
            />
            <span className="text-[10px] text-muted-foreground w-7 text-right tabular-nums">
              {volumePercent}%
            </span>
          </div>
        </label>

        {/* Playback Speed */}
        <label className={LABEL_CLS}>
          <span className={`text-[11px] ${LABEL_TEXT}`}>
            {t("pptx.media.speed")}
          </span>
          <select
            disabled={!canEdit}
            className={`${INPUT} text-[11px] max-w-[100px]`}
            value={element.playbackSpeed ?? 1}
            onChange={(e) =>
              onUpdateElement({
                playbackSpeed: Number(e.target.value),
              } as Partial<PptxElement>)
            }
          >
            <option value={0.25}>0.25x</option>
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>
        </label>

        {/* Fade In / Fade Out */}
        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex flex-col gap-0.5">
            <span className={`text-[11px] ${LABEL_TEXT}`}>
              {t("pptx.media.fadeIn")}
            </span>
            <input
              type="number"
              min={0}
              step={0.1}
              disabled={!canEdit}
              className={`${INPUT} text-[11px]`}
              value={element.fadeInDuration ?? 0}
              onChange={(e) =>
                onUpdateElement({
                  fadeInDuration: Number(e.target.value) || undefined,
                } as Partial<PptxElement>)
              }
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={`text-[11px] ${LABEL_TEXT}`}>
              {t("pptx.media.fadeOut")}
            </span>
            <input
              type="number"
              min={0}
              step={0.1}
              disabled={!canEdit}
              className={`${INPUT} text-[11px]`}
              value={element.fadeOutDuration ?? 0}
              onChange={(e) =>
                onUpdateElement({
                  fadeOutDuration: Number(e.target.value) || undefined,
                } as Partial<PptxElement>)
              }
            />
          </label>
        </div>

        {/* Toggles */}
        <label className={LABEL_CLS}>
          <span className={`text-[11px] ${LABEL_TEXT}`}>
            {t("pptx.media.loop")}
          </span>
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={Boolean(element.loop)}
            onChange={(e) =>
              onUpdateElement({
                loop: e.target.checked || undefined,
              } as Partial<PptxElement>)
            }
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className={`text-[11px] ${LABEL_TEXT}`}>
            {t("pptx.media.startTrigger")}
          </span>
          <select
            disabled={!canEdit}
            className="text-[11px] bg-transparent border border-border rounded px-1 py-0.5"
            value={element.autoPlay ? "auto" : "onClick"}
            onChange={(e) =>
              onUpdateElement({
                autoPlay: e.target.value === "auto" || undefined,
              } as Partial<PptxElement>)
            }
          >
            <option value="onClick">{t("pptx.media.startOnClick")}</option>
            <option value="auto">{t("pptx.media.startAutomatically")}</option>
          </select>
        </label>
        {element.mediaType === "audio" && (
          <label className={LABEL_CLS}>
            <span className={`text-[11px] ${LABEL_TEXT}`}>
              {t("pptx.media.playAcrossSlides")}
            </span>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={Boolean(element.playAcrossSlides)}
              onChange={(e) =>
                onUpdateElement({
                  playAcrossSlides: e.target.checked || undefined,
                  ...(e.target.checked ? { autoPlay: true } : {}),
                } as Partial<PptxElement>)
              }
            />
          </label>
        )}
        <label className={LABEL_CLS}>
          <span className={`text-[11px] ${LABEL_TEXT}`}>
            {t("pptx.media.fullScreen")}
          </span>
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={Boolean(element.fullScreen)}
            onChange={(e) =>
              onUpdateElement({
                fullScreen: e.target.checked || undefined,
              } as Partial<PptxElement>)
            }
          />
        </label>
        <label className={LABEL_CLS}>
          <span className={`text-[11px] ${LABEL_TEXT}`}>
            {t("pptx.media.hideWhenNotPlaying")}
          </span>
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={Boolean(element.hideWhenNotPlaying)}
            onChange={(e) =>
              onUpdateElement({
                hideWhenNotPlaying: e.target.checked || undefined,
              } as Partial<PptxElement>)
            }
          />
        </label>
      </div>

      {/* ── Bookmarks ── */}
      <div className={CARD}>
        <div className={HEADING}>
          <LuBookmark className="inline w-3 h-3 mr-1" />
          {t("pptx.media.bookmarks")}
        </div>

        {bookmarks.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {bookmarks
              .slice()
              .sort((a, b) => a.time - b.time)
              .map((bmk) => (
                <div
                  key={bmk.id}
                  className="flex items-center gap-1 text-[11px] group"
                >
                  <button
                    type="button"
                    className="text-primary hover:text-primary/80 truncate flex-1 text-left"
                    onClick={() => onSeekTo(bmk.time)}
                    title={t("pptx.media.seekToBookmark")}
                  >
                    {bmk.label}
                  </button>
                  <span className="text-muted-foreground tabular-nums text-[10px]">
                    {formatTime(bmk.time)}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                      onClick={() => handleRemoveBookmark(bmk.id)}
                      title={t("common.remove")}
                    >
                      <LuTrash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}

        {canEdit && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              className={`${INPUT} text-[11px]`}
              placeholder={t("pptx.media.bookmarkLabel")}
              value={newBookmarkLabel}
              onChange={(e) => setNewBookmarkLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddBookmark();
                }
              }}
            />
            <button
              type="button"
              className={BTN}
              onClick={handleAddBookmark}
              title={t("pptx.media.addBookmark")}
            >
              <LuPlus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
