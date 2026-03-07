import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../utils";
import type {
  PptxPresentationProperties,
  PptxCoreProperties,
  PptxAppProperties,
  PptxCustomProperty,
  PptxThemeOption,
  PptxTheme,
  PptxSlide,
  PptxNotesMaster,
  PptxHandoutMaster,
  PptxTagCollection,
} from "../../../core";
import type { CanvasSize } from "../../types";
import { CARD, HEADING } from "./inspector-pane-constants";
import { SlideThemeOverridePanel } from "./SlideThemeOverridePanel";
import { TagsSection } from "./TagsSection";
import {
  PresentationSettingsCard,
  ThemeSelectorCard,
  SlideSizeCard,
} from "./PresentationSettingsCards";
import {
  NotesHandoutCard,
  DocumentPropertiesCard,
} from "./DocumentPropertiesCards";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PresentationPropertiesPanelProps {
  presentationProperties: PptxPresentationProperties;
  canEdit: boolean;
  onUpdatePresentationProperties: (
    patch: Partial<PptxPresentationProperties>,
  ) => void;

  themeOptions: PptxThemeOption[];
  selectedThemePath: string;
  setSelectedThemePath: (path: string) => void;
  onApplyTheme: (path: string, allMasters: boolean) => void;

  activeSlide: PptxSlide | undefined;
  theme: PptxTheme | undefined;
  onUpdateSlide: (patch: Partial<PptxSlide>) => void;

  canvasSize: CanvasSize;
  onUpdateCanvasSize: (size: CanvasSize) => void;

  notesCanvasSize: CanvasSize | undefined;
  notesMaster: PptxNotesMaster | undefined;
  handoutMaster: PptxHandoutMaster | undefined;

  coreProperties: PptxCoreProperties | undefined;
  onUpdateCoreProperties: (patch: Partial<PptxCoreProperties>) => void;
  appProperties: PptxAppProperties | undefined;
  onUpdateAppProperties: (patch: Partial<PptxAppProperties>) => void;
  customProperties: PptxCustomProperty[];
  onUpdateCustomProperties: (props: PptxCustomProperty[]) => void;

  tagCollections: PptxTagCollection[] | undefined;
  onUpdateTagCollections: ((tags: PptxTagCollection[]) => void) | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresentationPropertiesPanel({
  presentationProperties,
  canEdit,
  onUpdatePresentationProperties,
  themeOptions,
  selectedThemePath,
  setSelectedThemePath,
  onApplyTheme,
  activeSlide,
  theme,
  onUpdateSlide,
  canvasSize,
  onUpdateCanvasSize,
  notesCanvasSize,
  notesMaster,
  handoutMaster,
  coreProperties,
  onUpdateCoreProperties,
  appProperties,
  onUpdateAppProperties,
  customProperties,
  onUpdateCustomProperties,
  tagCollections,
  onUpdateTagCollections,
}: PresentationPropertiesPanelProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <PresentationSettingsCard
        presentationProperties={presentationProperties}
        canEdit={canEdit}
        onUpdate={onUpdatePresentationProperties}
      />

      <ThemeSelectorCard
        themeOptions={themeOptions}
        selectedThemePath={selectedThemePath}
        setSelectedThemePath={setSelectedThemePath}
        canEdit={canEdit}
        onApplyTheme={onApplyTheme}
      />

      <div className={CARD}>
        <div className={HEADING}>{t("pptx.themeOverride.heading")}</div>
        <SlideThemeOverridePanel
          activeSlide={activeSlide}
          theme={theme}
          canEdit={canEdit}
          onUpdateSlide={onUpdateSlide}
        />
      </div>

      <SlideSizeCard
        canvasSize={canvasSize}
        canEdit={canEdit}
        onUpdate={onUpdateCanvasSize}
      />

      <NotesHandoutCard
        notesCanvasSize={notesCanvasSize}
        notesMaster={notesMaster}
        handoutMaster={handoutMaster}
      />

      <DocumentPropertiesCard
        coreProperties={coreProperties}
        appProperties={appProperties}
        customProperties={customProperties}
        canEdit={canEdit}
        onUpdateCoreProperties={onUpdateCoreProperties}
        onUpdateAppProperties={onUpdateAppProperties}
        onUpdateCustomProperties={onUpdateCustomProperties}
      />

      {tagCollections && onUpdateTagCollections && (
        <TagsSection
          tagCollections={tagCollections}
          onUpdateTagCollections={onUpdateTagCollections}
          canEdit={canEdit}
        />
      )}

      {activeSlide && (
        <div className={cn(CARD, "space-y-1")}>
          <div className={HEADING}>Slide</div>
          <div className="text-[11px] text-muted-foreground">
            {activeSlide.elements?.length ?? 0} elements
          </div>
        </div>
      )}
    </div>
  );
}
