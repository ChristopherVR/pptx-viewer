import React from "react";
import { useTranslation } from "react-i18next";
import { LuList, LuPipette } from "react-icons/lu";
import { cn } from "../../utils";
import { ic, pill, sep } from "./toolbar-constants";

export interface ViewSectionProps {
  canEdit: boolean;
  editTemplateMode: boolean;
  onSetEditTemplateMode: (mode: boolean) => void;
  spellCheckEnabled: boolean;
  onSetSpellCheckEnabled: (enabled: boolean) => void;
  showGrid: boolean;
  showRulers: boolean;
  snapToGrid: boolean;
  snapToShape: boolean;
  onSetShowGrid: (enabled: boolean) => void;
  onSetShowRulers: (enabled: boolean) => void;
  onSetSnapToGrid: (enabled: boolean) => void;
  onSetSnapToShape: (enabled: boolean) => void;
  onAddGuide: (axis: "h" | "v") => void;
  onEnterMasterView: () => void;
  isSelectionPaneOpen?: boolean;
  onToggleSelectionPane?: () => void;
  eyedropperActive?: boolean;
  onToggleEyedropper?: () => void;
}

export function ViewSection(p: ViewSectionProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <button
        onClick={() => p.onSetEditTemplateMode(!p.editTemplateMode)}
        disabled={!p.canEdit}
        className={cn(
          pill,
          p.editTemplateMode
            ? "bg-amber-600 hover:bg-amber-500 text-amber-50"
            : "",
        )}
        title="Toggle template/master element editing"
      >
        {p.editTemplateMode ? "Templates On" : "Templates Off"}
      </button>
      {p.onToggleSelectionPane && (
        <button
          type="button"
          onClick={p.onToggleSelectionPane}
          className={cn(
            pill,
            p.isSelectionPaneOpen
              ? "bg-primary hover:bg-primary/80 text-primary-foreground"
              : "",
          )}
          title="Selection Pane"
        >
          <LuList className={ic} />
          Selection
        </button>
      )}
      {p.onToggleEyedropper && (
        <button
          type="button"
          onClick={p.onToggleEyedropper}
          disabled={!p.canEdit}
          className={cn(
            pill,
            p.eyedropperActive
              ? "bg-purple-600 hover:bg-purple-500 text-purple-50"
              : "",
          )}
          title="Eyedropper — sample a colour from the slide"
        >
          <LuPipette className={ic} />
          Eyedropper
        </button>
      )}
      <button
        onClick={() => p.onSetShowGrid(!p.showGrid)}
        className={cn(
          pill,
          p.showGrid ? "bg-primary text-primary-foreground" : "",
        )}
        title={t("pptx.grid.toggleGrid")}
      >
        {t("pptx.grid.grid")}
      </button>
      <button
        onClick={() => p.onSetShowRulers(!p.showRulers)}
        className={cn(
          pill,
          p.showRulers ? "bg-primary text-primary-foreground" : "",
        )}
        title={t("pptx.ruler.toggleRulers")}
      >
        {t("pptx.ruler.rulers")}
      </button>
      <button
        onClick={() => p.onSetSnapToGrid(!p.snapToGrid)}
        className={cn(
          pill,
          p.snapToGrid ? "bg-primary text-primary-foreground" : "",
        )}
        title={t("pptx.grid.snapToGrid")}
      >
        {t("pptx.grid.snapToGrid")}
      </button>
      <button
        onClick={() => p.onSetSnapToShape(!p.snapToShape)}
        className={cn(
          pill,
          p.snapToShape ? "bg-primary text-primary-foreground" : "",
        )}
        title={t("pptx.grid.snapToShape")}
      >
        {t("pptx.grid.snapToShape")}
      </button>
      <button
        onClick={() => p.onAddGuide("h")}
        className={pill}
        title="Add horizontal guide"
      >
        H Guide
      </button>
      <button
        onClick={() => p.onAddGuide("v")}
        className={pill}
        title="Add vertical guide"
      >
        V Guide
      </button>
      <button
        onClick={() => p.onSetSpellCheckEnabled(!p.spellCheckEnabled)}
        className={cn(
          pill,
          p.spellCheckEnabled ? "bg-primary text-primary-foreground" : "",
        )}
        title="Toggle spell check"
      >
        Spell
      </button>
      {sep}
      <button
        onClick={p.onEnterMasterView}
        disabled={!p.canEdit}
        className={pill}
        title="Edit slide masters and layouts"
      >
        Slide Master
      </button>
    </>
  );
}
