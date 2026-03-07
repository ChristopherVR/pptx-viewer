import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuChevronRight, LuTrash2 } from "react-icons/lu";

import { cn } from "../../utils";
import type { PptxTagCollection } from "../../../core";
import { HEADING, CARD, INPUT, BTN } from "./inspector-pane-constants";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TagsSectionProps {
  tagCollections: PptxTagCollection[];
  onUpdateTagCollections: (next: PptxTagCollection[]) => void;
  canEdit: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagsSection({
  tagCollections,
  onUpdateTagCollections,
  canEdit,
}: TagsSectionProps): React.ReactElement {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(true);

  const allTags = tagCollections.flatMap((col, colIdx) =>
    col.tags.map((tag, tagIdx) => ({ ...tag, colIdx, tagIdx })),
  );

  const updateTag = (
    colIdx: number,
    tagIdx: number,
    field: "name" | "value",
    newValue: string,
  ) => {
    const next = tagCollections.map((col, ci) => {
      if (ci !== colIdx) return col;
      return {
        ...col,
        tags: col.tags.map((tag, ti) =>
          ti === tagIdx ? { ...tag, [field]: newValue } : tag,
        ),
      };
    });
    onUpdateTagCollections(next);
  };

  const deleteTag = (colIdx: number, tagIdx: number) => {
    const next = tagCollections.map((col, ci) => {
      if (ci !== colIdx) return col;
      return {
        ...col,
        tags: col.tags.filter((_, ti) => ti !== tagIdx),
      };
    });
    onUpdateTagCollections(next);
  };

  const addTag = () => {
    if (tagCollections.length === 0) {
      onUpdateTagCollections([
        { path: "ppt/tags/tag1.xml", tags: [{ name: "", value: "" }] },
      ]);
    } else {
      const next = tagCollections.map((col, ci) => {
        if (ci !== 0) return col;
        return { ...col, tags: [...col.tags, { name: "", value: "" }] };
      });
      onUpdateTagCollections(next);
    }
  };

  return (
    <div className={CARD}>
      <button
        type="button"
        className="flex items-center gap-1 w-full"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <LuChevronRight className="w-3 h-3 text-muted-foreground" />
        ) : (
          <LuChevronDown className="w-3 h-3 text-muted-foreground" />
        )}
        <span className={HEADING}>{t("pptx.tags.title")}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {allTags.length}
        </span>
      </button>
      {!collapsed && (
        <div className="space-y-1.5">
          {allTags.length === 0 ? (
            <div className="text-[10px] text-muted-foreground">
              {t("pptx.tags.noTags")}
            </div>
          ) : (
            allTags.map((tag, idx) => (
              <div
                key={`${tag.colIdx}-${tag.tagIdx}-${idx}`}
                className="grid grid-cols-[1fr,1fr,auto] gap-1 text-[11px]"
              >
                <input
                  type="text"
                  className={INPUT}
                  disabled={!canEdit}
                  placeholder={t("pptx.tags.name")}
                  value={tag.name}
                  onChange={(e) =>
                    updateTag(tag.colIdx, tag.tagIdx, "name", e.target.value)
                  }
                />
                <input
                  type="text"
                  className={INPUT}
                  disabled={!canEdit}
                  placeholder={t("pptx.tags.value")}
                  value={tag.value}
                  onChange={(e) =>
                    updateTag(tag.colIdx, tag.tagIdx, "value", e.target.value)
                  }
                />
                {canEdit && (
                  <button
                    type="button"
                    className={cn(
                      BTN,
                      "px-1.5 text-red-400 hover:text-red-300",
                    )}
                    title={t("pptx.tags.deleteTag")}
                    onClick={() => deleteTag(tag.colIdx, tag.tagIdx)}
                  >
                    <LuTrash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
          {canEdit && (
            <button type="button" className={BTN} onClick={addTag}>
              {t("pptx.tags.addTag")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
