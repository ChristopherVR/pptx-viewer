/**
 * ShowOptionsFieldset
 *
 * Fieldset sub-component for slide show option checkboxes:
 * loop, narration, animation, and subtitles.
 */
import React from "react";
import { useTranslation } from "react-i18next";

import type { PptxPresentationProperties } from "../../core";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShowOptionsFieldsetProps {
  draft: PptxPresentationProperties;
  update: (patch: Partial<PptxPresentationProperties>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShowOptionsFieldset({
  draft,
  update,
}: ShowOptionsFieldsetProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {t("pptx.slideShow.showOptions")}
      </legend>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(draft.loopContinuously)}
          onChange={(e) =>
            update({
              loopContinuously: e.target.checked,
            })
          }
          className="accent-primary"
        />
        <span>{t("pptx.slideShow.loopContinuously")}</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.showWithNarration === false}
          onChange={(e) =>
            update({
              showWithNarration: !e.target.checked,
            })
          }
          className="accent-primary"
        />
        <span>{t("pptx.slideShow.showWithoutNarration")}</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.showWithAnimation === false}
          onChange={(e) =>
            update({
              showWithAnimation: !e.target.checked,
            })
          }
          className="accent-primary"
        />
        <span>{t("pptx.slideShow.showWithoutAnimation")}</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(draft.showSubtitles)}
          onChange={(e) => update({ showSubtitles: e.target.checked })}
          className="accent-primary"
        />
        <span>{t("pptx.slideShow.showSubtitles")}</span>
      </label>
    </fieldset>
  );
}
