import React from "react";
import { LuEllipsis } from "react-icons/lu";
import { cn } from "../../utils";
import { ic, OV } from "./toolbar-constants";
import type { ToolbarProps } from "./toolbar-types";

type OverflowKeys =
  | "onExportPng"
  | "onExportPdf"
  | "onExportVideo"
  | "onExportGif"
  | "onPackageForSharing"
  | "onSaveAsPpsx"
  | "onSaveAsPptm"
  | "onPrint"
  | "onCopySlideAsImage"
  | "onRunAccessibilityCheck"
  | "onToggleShortcuts"
  | "onToggleVersionHistory"
  | "onOpenDocumentProperties"
  | "onOpenPasswordProtection"
  | "onOpenFontEmbedding"
  | "onOpenDigitalSignatures"
  | "hasMacros"
  | "isOverflowMenuOpen"
  | "onSetOverflowMenuOpen";

export type OverflowMenuProps = Pick<ToolbarProps, OverflowKeys>;

export function OverflowMenu(p: OverflowMenuProps): React.ReactElement {
  const ovAct = (k: string) => {
    p.onSetOverflowMenuOpen(false);
    (
      ({
        png: p.onExportPng,
        pdf: p.onExportPdf,
        video: p.onExportVideo,
        gif: p.onExportGif,
        package: p.onPackageForSharing,
        ppsx: p.onSaveAsPpsx,
        pptm: p.onSaveAsPptm,
        print: p.onPrint,
        copyImg: p.onCopySlideAsImage,
        a11y: p.onRunAccessibilityCheck,
        shortcuts: p.onToggleShortcuts,
        versionHistory: p.onToggleVersionHistory,
        documentProperties: p.onOpenDocumentProperties,
        passwordProtection: p.onOpenPasswordProtection,
        fontEmbedding: p.onOpenFontEmbedding,
        digitalSignatures: p.onOpenDigitalSignatures,
      }) as Record<string, (() => void) | undefined>
    )[k]?.();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => p.onSetOverflowMenuOpen(!p.isOverflowMenuOpen)}
        className={cn(
          "p-1.5 rounded transition-colors",
          p.isOverflowMenuOpen
            ? "bg-primary/80 text-primary-foreground"
            : "bg-muted hover:bg-accent",
        )}
        title="More actions"
        aria-label="More actions"
      >
        <LuEllipsis className={ic} />
      </button>
      {p.isOverflowMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close menu"
            onClick={() => p.onSetOverflowMenuOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1">
            {OV.filter((o) => o.k !== "pptm" || p.hasMacros).map((o) =>
              o.k.startsWith("---") ? (
                <div key={o.k} className="my-1 border-t border-border/60" />
              ) : (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => ovAct(o.k)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  {o.i}
                  {o.l}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
