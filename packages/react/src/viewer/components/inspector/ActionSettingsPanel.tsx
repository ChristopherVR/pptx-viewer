import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../utils";
import type {
  PptxElement,
  PptxSlide,
  ElementAction,
  ElementActionType,
} from "pptx-viewer-core";
import {
  pptxActionToElementAction,
  elementActionToPptxAction,
} from "pptx-viewer-core";
import { CARD, HEADING, INPUT } from "./inspector-pane-constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActionSettingsPanelProps {
  selectedElement: PptxElement;
  slides: PptxSlide[];
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_TYPE_OPTIONS: Array<{ value: ElementActionType; label: string }> =
  [
    { value: "none", label: "None" },
    { value: "url", label: "Go to URL" },
    { value: "slide", label: "Go to Slide" },
    { value: "firstSlide", label: "First Slide" },
    { value: "lastSlide", label: "Last Slide" },
    { value: "prevSlide", label: "Previous Slide" },
    { value: "nextSlide", label: "Next Slide" },
    { value: "endShow", label: "End Show" },
  ];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionSettingsPanel({
  selectedElement,
  slides,
  canEdit,
  onUpdateElement,
}: ActionSettingsPanelProps): React.ReactElement {
  const { t } = useTranslation();

  const clickAction: ElementAction | undefined = selectedElement.actionClick
    ? pptxActionToElementAction(selectedElement.actionClick, "click")
    : undefined;

  const hoverAction: ElementAction | undefined = selectedElement.actionHover
    ? pptxActionToElementAction(selectedElement.actionHover, "hover")
    : undefined;

  const activeClickType: ElementActionType = clickAction?.type ?? "none";
  const activeHoverType: ElementActionType = hoverAction?.type ?? "none";

  const updateAction = (
    trigger: "click" | "hover",
    type: ElementActionType,
    url?: string,
    slideIndex?: number,
  ) => {
    const ea: ElementAction = { trigger, type, url, slideIndex };
    const pa = elementActionToPptxAction(ea);
    if (trigger === "click") {
      onUpdateElement({ actionClick: pa } as Partial<PptxElement>);
    } else {
      onUpdateElement({ actionHover: pa } as Partial<PptxElement>);
    }
  };

  return (
    <div className={CARD}>
      <div className={HEADING}>{t("pptx.action.title", "Action")}</div>
      <div className="space-y-2 text-[11px]">
        {/* On Click */}
        <ActionTriggerSection
          label={t("pptx.action.onClick", "On Click")}
          trigger="click"
          activeType={activeClickType}
          action={clickAction}
          fallbackUrl={selectedElement.actionClick?.url}
          fallbackSlideIndex={selectedElement.actionClick?.targetSlideIndex}
          canEdit={canEdit}
          slideCount={slides.length}
          onChangeType={(type) =>
            updateAction(
              "click",
              type,
              clickAction?.url,
              clickAction?.slideIndex,
            )
          }
          onChangeUrl={(url) => updateAction("click", "url", url)}
          onChangeSlide={(idx) =>
            updateAction("click", "slide", undefined, idx)
          }
        />

        {/* On Hover */}
        <ActionTriggerSection
          label={t("pptx.action.onHover", "On Hover")}
          trigger="hover"
          activeType={activeHoverType}
          action={hoverAction}
          fallbackUrl={selectedElement.actionHover?.url}
          fallbackSlideIndex={selectedElement.actionHover?.targetSlideIndex}
          canEdit={canEdit}
          slideCount={slides.length}
          onChangeType={(type) =>
            updateAction(
              "hover",
              type,
              hoverAction?.url,
              hoverAction?.slideIndex,
            )
          }
          onChangeUrl={(url) => updateAction("hover", "url", url)}
          onChangeSlide={(idx) =>
            updateAction("hover", "slide", undefined, idx)
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: a single trigger block (Click or Hover)
// ---------------------------------------------------------------------------

interface ActionTriggerSectionProps {
  label: string;
  trigger: "click" | "hover";
  activeType: ElementActionType;
  action: ElementAction | undefined;
  fallbackUrl: string | undefined;
  fallbackSlideIndex: number | undefined;
  canEdit: boolean;
  slideCount: number;
  onChangeType: (type: ElementActionType) => void;
  onChangeUrl: (url: string) => void;
  onChangeSlide: (idx: number) => void;
}

function ActionTriggerSection({
  label,
  activeType,
  action,
  fallbackUrl,
  fallbackSlideIndex,
  canEdit,
  slideCount,
  onChangeType,
  onChangeUrl,
  onChangeSlide,
}: ActionTriggerSectionProps): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <span className="text-muted-foreground font-medium">{label}</span>
      <select
        disabled={!canEdit}
        className={cn(INPUT, "w-full")}
        value={activeType}
        onChange={(e) => onChangeType(e.target.value as ElementActionType)}
      >
        {ACTION_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {activeType === "url" && (
        <input
          type="text"
          disabled={!canEdit}
          className={cn(INPUT, "w-full")}
          placeholder="https://..."
          value={action?.url ?? fallbackUrl ?? ""}
          onChange={(e) => onChangeUrl(e.target.value)}
        />
      )}

      {activeType === "slide" && (
        <input
          type="number"
          disabled={!canEdit}
          className={cn(INPUT, "w-full")}
          placeholder="Slide number (1-based)"
          min={1}
          max={slideCount}
          value={(action?.slideIndex ?? fallbackSlideIndex ?? 0) + 1}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChangeSlide(Math.max(0, n - 1));
          }}
        />
      )}
    </div>
  );
}
