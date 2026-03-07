import type React from "react";

import { LuChevronDown } from "react-icons/lu";

import { cn } from "../../utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  sectionId: string;
  label: string;
  slideCount: number;
  isCollapsed: boolean;
  isRenaming: boolean;
  renameValue: string;
  canEdit: boolean;
  sectionIndex: number;
  totalSections: number;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onToggle: (sectionId: string) => void;
  onContextMenu: (
    e: React.MouseEvent,
    sectionId: string,
    sectionIndex: number,
    totalSections: number,
  ) => void;
  onStartRename: (sectionId: string, label: string) => void;
  onRenameValueChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SectionHeader({
  sectionId,
  label,
  slideCount,
  isCollapsed,
  isRenaming,
  renameValue,
  canEdit,
  sectionIndex,
  totalSections,
  renameInputRef,
  onToggle,
  onContextMenu,
  onStartRename,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
}: SectionHeaderProps): React.ReactElement {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      onClick={() => onToggle(sectionId)}
      onContextMenu={(e) =>
        canEdit
          ? onContextMenu(e, sectionId, sectionIndex, totalSections)
          : undefined
      }
      onDoubleClick={(e) => {
        if (!canEdit) return;
        e.stopPropagation();
        onStartRename(sectionId, label);
      }}
    >
      <LuChevronDown
        className={cn(
          "h-3 w-3 flex-shrink-0 transition-transform",
          isCollapsed ? "-rotate-90" : "rotate-0",
        )}
      />
      {isRenaming ? (
        <input
          ref={renameInputRef}
          type="text"
          className="flex-1 bg-muted text-[11px] text-foreground rounded px-1 py-0.5 outline-none border border-primary"
          value={renameValue}
          onChange={(e) => onRenameValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommitRename();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancelRename();
            }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          onBlur={onCommitRename}
        />
      ) : (
        <>
          <span className="truncate text-left">{label}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {slideCount}
          </span>
        </>
      )}
    </button>
  );
}
