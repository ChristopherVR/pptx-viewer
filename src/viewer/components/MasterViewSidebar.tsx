import React, { useCallback, useRef } from "react";

import { LuPanelLeftClose } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import type {
  PptxSlideMaster,
  PptxNotesMaster,
  PptxHandoutMaster,
  MasterViewTab,
} from "../../core";
import { cn } from "../utils";
import type { CanvasSize } from "../types";
import { SlideMastersList } from "./SlideMastersList";
import { NotesMasterPanel } from "./NotesMasterPanel";
import { HandoutMasterPanel } from "./HandoutMasterPanel";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS: { key: MasterViewTab; labelKey: string }[] = [
  { key: "slides", labelKey: "pptx.master.tabSlides" },
  { key: "notes", labelKey: "pptx.master.tabNotes" },
  { key: "handout", labelKey: "pptx.master.tabHandout" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MasterViewSidebarProps {
  slideMasters: PptxSlideMaster[];
  activeMasterIndex: number;
  activeLayoutIndex: number | null;
  canvasSize: CanvasSize;
  masterViewTab: MasterViewTab;
  notesMaster: PptxNotesMaster | undefined;
  handoutMaster: PptxHandoutMaster | undefined;
  handoutSlidesPerPage: number;
  onSelectMaster: (index: number) => void;
  onSelectLayout: (masterIndex: number, layoutIndex: number) => void;
  onCollapse: () => void;
  onTabChange: (tab: MasterViewTab) => void;
  onHandoutSlidesPerPageChange: (count: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MasterViewSidebar({
  slideMasters,
  activeMasterIndex,
  activeLayoutIndex,
  canvasSize,
  masterViewTab,
  notesMaster,
  handoutMaster,
  handoutSlidesPerPage,
  onSelectMaster,
  onSelectLayout,
  onCollapse,
  onTabChange,
  onHandoutSlidesPerPageChange,
}: MasterViewSidebarProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const handleMasterClick = useCallback(
    (index: number) => {
      onSelectMaster(index);
    },
    [onSelectMaster],
  );

  const handleLayoutClick = useCallback(
    (masterIdx: number, layoutIdx: number) => {
      onSelectLayout(masterIdx, layoutIdx);
    },
    [onSelectLayout],
  );

  return (
    <aside className="flex h-full flex-col border-r border-border/80 bg-background/70 backdrop-blur-sm w-56">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {masterViewTab === "slides"
            ? t("pptx.master.title")
            : masterViewTab === "notes"
              ? t("pptx.master.notesMasterTitle")
              : t("pptx.master.handoutMasterTitle")}
        </span>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t("pptx.master.collapseMasterPane")}
          onClick={onCollapse}
        >
          <LuPanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={cn(
              "flex-1 px-1 py-1.5 text-[10px] font-medium transition-colors border-b-2",
              masterViewTab === tab.key
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onTabChange(tab.key)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Scrollable content per tab */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-1.5 pb-2 pt-1"
      >
        {masterViewTab === "slides" && (
          <SlideMastersList
            slideMasters={slideMasters}
            activeMasterIndex={activeMasterIndex}
            activeLayoutIndex={activeLayoutIndex}
            canvasSize={canvasSize}
            onSelectMaster={handleMasterClick}
            onSelectLayout={handleLayoutClick}
          />
        )}

        {masterViewTab === "notes" && (
          <NotesMasterPanel notesMaster={notesMaster} />
        )}

        {masterViewTab === "handout" && (
          <HandoutMasterPanel
            handoutMaster={handoutMaster}
            slidesPerPage={handoutSlidesPerPage}
            onSlidesPerPageChange={onHandoutSlidesPerPageChange}
          />
        )}
      </div>
    </aside>
  );
}
