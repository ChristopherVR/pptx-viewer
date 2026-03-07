import React from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../utils";
import type {
  PptxElement,
  PptxSmartArtData,
  SmartArtColorScheme,
  SmartArtStyle,
} from "pptx-viewer-core";
import { HEADING, CARD, INPUT, BTN } from "./inspector-pane-constants";
import { SmartArtLayoutSwitcher } from "./SmartArtLayoutSwitcher";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SmartArtPropertiesPanelProps {
  smartArtData: PptxSmartArtData;
  canEdit: boolean;
  onUpdateElement: (updates: Partial<PptxElement>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_SCHEMES: SmartArtColorScheme[] = [
  "colorful1",
  "colorful2",
  "colorful3",
  "monochromatic1",
  "monochromatic2",
];

const STYLE_OPTIONS: SmartArtStyle[] = ["flat", "moderate", "intense"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SmartArtPropertiesPanel({
  smartArtData,
  canEdit,
  onUpdateElement,
}: SmartArtPropertiesPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const nodes = smartArtData.nodes ?? [];

  const updateSmartArt = (patch: Partial<PptxSmartArtData>) => {
    onUpdateElement({
      smartArtData: { ...smartArtData, ...patch },
    } as Partial<PptxElement>);
  };

  const updateNodeText = (nodeId: string, text: string) => {
    updateSmartArt({
      nodes: nodes.map((n) => (n.id === nodeId ? { ...n, text } : n)),
    });
  };

  const addNode = () => {
    updateSmartArt({
      nodes: [
        ...nodes,
        {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: `Item ${nodes.length + 1}`,
        },
      ],
    });
  };

  const addSubItem = (parentId: string) => {
    updateSmartArt({
      nodes: [
        ...nodes,
        {
          id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: "Sub-item",
          parentId,
        },
      ],
    });
  };

  const removeNode = (nodeId: string) => {
    const filtered = nodes.filter((n) => n.id !== nodeId);
    updateSmartArt({
      nodes: filtered.map((n) =>
        n.parentId === nodeId ? { ...n, parentId: undefined } : n,
      ),
    });
  };

  const promoteNode = (nodeId: string) => {
    updateSmartArt({
      nodes: nodes.map((n) =>
        n.id === nodeId ? { ...n, parentId: undefined } : n,
      ),
    });
  };

  const demoteNode = (nodeId: string) => {
    const topLevel = nodes.filter((n) => !n.parentId);
    const idx = topLevel.findIndex((n) => n.id === nodeId);
    if (idx > 0) {
      const parentId = topLevel[idx - 1].id;
      updateSmartArt({
        nodes: nodes.map((n) => (n.id === nodeId ? { ...n, parentId } : n)),
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nodeId: string) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      demoteNode(nodeId);
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      promoteNode(nodeId);
    }
  };

  return (
    <div className={CARD}>
      <div className={HEADING}>{t("pptx.smartart.title")}</div>
      <div className="space-y-2">
        <SmartArtLayoutSwitcher
          smartArtData={smartArtData}
          canEdit={canEdit}
          onUpdateSmartArt={updateSmartArt}
        />

        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-muted-foreground">
            {t("pptx.smartart.colorScheme")}
          </span>
          <select
            disabled={!canEdit}
            className={cn(INPUT, "w-full")}
            value={smartArtData.colorScheme ?? "colorful1"}
            onChange={(e) =>
              updateSmartArt({
                colorScheme: e.target.value as SmartArtColorScheme,
              })
            }
          >
            {COLOR_SCHEMES.map((cs) => (
              <option key={cs} value={cs}>
                {cs}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px]">
          <span className="text-muted-foreground">
            {t("pptx.smartart.style")}
          </span>
          <div className="flex gap-1">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={!canEdit}
                className={cn(
                  "flex-1 px-2 py-1 text-[10px] rounded border transition-colors",
                  (smartArtData.style ?? "flat") === s
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
                onClick={() => updateSmartArt({ style: s })}
              >
                {s}
              </button>
            ))}
          </div>
        </label>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {t("pptx.smartart.textPane")} ({nodes.length})
          </span>
          <button
            type="button"
            disabled={!canEdit}
            className={BTN}
            onClick={addNode}
          >
            {t("pptx.smartart.addItem")}
          </button>
        </div>

        <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
          {nodes.map((node, idx) => {
            const isChild = Boolean(node.parentId);
            return (
              <div
                key={node.id}
                className={cn(
                  "rounded border bg-background/60 p-1.5",
                  isChild ? "border-border/60 ml-4" : "border-border",
                )}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground w-3 shrink-0">
                    {isChild ? "\u2022" : `${idx + 1}`}
                  </span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    className={cn(INPUT, "flex-1 text-[11px] py-0.5")}
                    value={node.text}
                    onChange={(e) => updateNodeText(node.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, node.id)}
                    placeholder={t("pptx.smartart.typePlaceholder")}
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!isChild && (
                      <button
                        type="button"
                        disabled={!canEdit}
                        className="text-[9px] text-muted-foreground hover:text-primary px-1"
                        onClick={() => addSubItem(node.id)}
                        title={t("pptx.smartart.addSubItem")}
                      >
                        +Sub
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!canEdit || nodes.length <= 1}
                      className="text-[9px] text-muted-foreground hover:text-red-400 px-1"
                      onClick={() => removeNode(node.id)}
                      title={t("pptx.smartart.remove")}
                    >
                      x
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[9px] text-muted-foreground mt-1">
          {t("pptx.smartart.tabHint")}
        </div>
      </div>
    </div>
  );
}
