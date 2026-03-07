import React from "react";

import { cn } from "../utils";
import type { AccessibilityIssue } from "../types";

interface AccessibilityPanelProps {
  isOpen: boolean;
  issues: AccessibilityIssue[];
  onClose: () => void;
}

export function AccessibilityPanel({
  isOpen,
  issues,
  onClose,
}: AccessibilityPanelProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="absolute top-14 right-3 z-40 w-[min(28rem,calc(100%-1.5rem))] rounded border border-border bg-popover shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-foreground">
          Accessibility Checker
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            {issues.length} issue
            {issues.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-[11px] text-foreground hover:bg-muted hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto p-2 space-y-1">
        {issues.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-4">
            No accessibility issues found.
          </div>
        ) : (
          issues.map((issue, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-start gap-2 rounded px-2 py-1.5 text-xs",
                issue.severity === "error"
                  ? "bg-red-900/30 text-red-300"
                  : issue.severity === "warning"
                    ? "bg-amber-900/30 text-amber-300"
                    : "bg-muted/50 text-muted-foreground",
              )}
            >
              <span className="shrink-0 mt-0.5">
                {issue.severity === "error"
                  ? "●"
                  : issue.severity === "warning"
                    ? "▲"
                    : "ℹ"}
              </span>
              <span>{issue.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
