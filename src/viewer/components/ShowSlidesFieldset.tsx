/**
 * ShowSlidesFieldset
 *
 * Fieldset sub-component for selecting which slides to show in a slide show:
 * all slides, a range, or a custom show.
 */
import React from "react";
import { useTranslation } from "react-i18next";

import type {
  PptxPresentationProperties,
  PptxCustomShow,
} from "../../core";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShowSlidesFieldsetProps {
  draft: PptxPresentationProperties;
  update: (patch: Partial<PptxPresentationProperties>) => void;
  showSlidesMode: "all" | "customShow" | "range";
  slideCount: number;
  customShows: PptxCustomShow[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShowSlidesFieldset({
  draft,
  update,
  showSlidesMode,
  slideCount,
  customShows,
}: ShowSlidesFieldsetProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {t("pptx.slideShow.showSlides")}
      </legend>

      {/* All */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="showSlides"
          value="all"
          checked={showSlidesMode === "all"}
          onChange={() => update({ showSlidesMode: "all" })}
          className="accent-primary"
        />
        <span>{t("pptx.slideShow.allSlides")}</span>
      </label>

      {/* Range */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="showSlides"
          value="range"
          checked={showSlidesMode === "range"}
          onChange={() =>
            update({
              showSlidesMode: "range",
              showSlidesFrom: draft.showSlidesFrom ?? 1,
              showSlidesTo: draft.showSlidesTo ?? slideCount,
            })
          }
          className="accent-primary"
        />
        <span>{t("pptx.slideShow.fromTo")}</span>
      </label>
      {showSlidesMode === "range" && (
        <div className="flex items-center gap-2 ml-6">
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">
              {t("pptx.slideShow.from")}
            </span>
            <input
              type="number"
              min={1}
              max={slideCount}
              value={draft.showSlidesFrom ?? 1}
              onChange={(e) =>
                update({
                  showSlidesFrom: Math.max(
                    1,
                    Number.parseInt(e.target.value, 10) || 1,
                  ),
                })
              }
              className="w-14 px-1.5 py-0.5 rounded bg-muted border border-border text-foreground text-[11px]"
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">
              {t("pptx.slideShow.to")}
            </span>
            <input
              type="number"
              min={1}
              max={slideCount}
              value={draft.showSlidesTo ?? slideCount}
              onChange={(e) =>
                update({
                  showSlidesTo: Math.min(
                    slideCount,
                    Number.parseInt(e.target.value, 10) || slideCount,
                  ),
                })
              }
              className="w-14 px-1.5 py-0.5 rounded bg-muted border border-border text-foreground text-[11px]"
            />
          </label>
        </div>
      )}

      {/* Custom Show */}
      {customShows.length > 0 && (
        <>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="showSlides"
              value="customShow"
              checked={showSlidesMode === "customShow"}
              onChange={() =>
                update({
                  showSlidesMode: "customShow",
                  showSlidesCustomShowId:
                    draft.showSlidesCustomShowId ?? customShows[0]?.id,
                })
              }
              className="accent-primary"
            />
            <span>{t("pptx.slideShow.customShow")}</span>
          </label>
          {showSlidesMode === "customShow" && (
            <div className="ml-6">
              <select
                value={draft.showSlidesCustomShowId ?? customShows[0]?.id ?? ""}
                onChange={(e) =>
                  update({
                    showSlidesCustomShowId: e.target.value,
                  })
                }
                className="w-full px-2 py-1 rounded bg-muted border border-border text-foreground text-[11px]"
              >
                {customShows.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
