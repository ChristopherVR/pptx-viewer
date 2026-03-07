import React, { useState, useEffect, useRef } from "react";
import { LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import { cn } from "../utils";
import type {
  HyperlinkTargetType,
  HyperlinkActionVerb,
} from "./hyperlink-edit-types";
import { ACTION_VERB_MAP } from "./hyperlink-edit-types";
import {
  detectTargetType,
  parseEmailUrl,
  parseSlideFromUrl,
} from "./hyperlink-edit-utils";
import { HyperlinkTabContent } from "./HyperlinkTabContent";

// Re-export types and utilities for backwards compatibility
export type {
  HyperlinkTargetType,
  HyperlinkActionVerb,
  HyperlinkEditData,
} from "./hyperlink-edit-types";
export { resolveHyperlinkEditResult } from "./hyperlink-edit-utils";

/**
 * Props for the {@link HyperlinkEditDialog} component.
 */
interface HyperlinkEditDialogProps {
  open: boolean;
  initialUrl?: string;
  initialTooltip?: string;
  initialAction?: string;
  slideCount: number;
  onConfirm: (data: {
    targetType: HyperlinkTargetType;
    url: string;
    tooltip: string;
    emailAddress: string;
    emailSubject: string;
    slideNumber: number;
    filePath: string;
    actionVerb: HyperlinkActionVerb;
  }) => void;
  onCancel: () => void;
}

/**
 * Tabbed modal dialog for creating or editing hyperlinks.
 *
 * Supports five target types via tabs: URL, Email, Slide, File, and
 * Action (navigation verbs like next/previous slide). The initial tab
 * is auto-detected from the provided `initialUrl` / `initialAction`.
 *
 * All field state is managed locally and emitted as a single object
 * through `onConfirm` when the user applies the changes.
 *
 * @param props - {@link HyperlinkEditDialogProps}
 * @returns The dialog element, or `null` when `open` is `false`.
 */
export function HyperlinkEditDialog({
  open,
  initialUrl,
  initialTooltip,
  initialAction,
  slideCount,
  onConfirm,
  onCancel,
}: HyperlinkEditDialogProps): React.ReactElement | null {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const detectedType = detectTargetType(initialUrl, initialAction);
  const emailParts = parseEmailUrl(initialUrl || "");
  const detectedSlide = parseSlideFromUrl(initialUrl, initialAction);
  const detectedVerb = initialAction
    ? ACTION_VERB_MAP[initialAction.toLowerCase()] || "nextSlide"
    : "nextSlide";

  const [targetType, setTargetType] =
    useState<HyperlinkTargetType>(detectedType);
  const [url, setUrl] = useState(
    detectedType === "email" ||
      detectedType === "slide" ||
      detectedType === "action"
      ? ""
      : initialUrl || "",
  );
  const [tooltip, setTooltip] = useState(initialTooltip || "");
  const [emailAddress, setEmailAddress] = useState(emailParts.address);
  const [emailSubject, setEmailSubject] = useState(emailParts.subject);
  const [slideNumber, setSlideNumber] = useState(detectedSlide);
  const [filePath, setFilePath] = useState(
    detectedType === "file" ? initialUrl || "" : "",
  );
  const [actionVerb, setActionVerb] =
    useState<HyperlinkActionVerb>(detectedVerb);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm({
      targetType,
      url,
      tooltip,
      emailAddress,
      emailSubject,
      slideNumber,
      filePath,
      actionVerb,
    });
  };

  const tabCls = (active: boolean) =>
    cn(
      "px-3 py-1.5 text-xs rounded-t border-b-2 transition-colors",
      active
        ? "border-primary text-primary font-medium"
        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
    );

  const inputCls =
    "w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary";

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/40" onClick={onCancel} />
      <div className="fixed inset-0 z-[201] flex items-center justify-center pointer-events-none">
        <div
          className="pointer-events-auto w-[440px] rounded-lg border border-border bg-popover shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              {t("pptx.hyperlink.editTitle")}
            </h2>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={onCancel}
            >
              <LuX className="w-4 h-4" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 px-4 pt-2 border-b border-border">
            <button
              type="button"
              className={tabCls(targetType === "url")}
              onClick={() => setTargetType("url")}
            >
              {t("pptx.hyperlink.tabUrl")}
            </button>
            <button
              type="button"
              className={tabCls(targetType === "email")}
              onClick={() => setTargetType("email")}
            >
              {t("pptx.hyperlink.tabEmail")}
            </button>
            <button
              type="button"
              className={tabCls(targetType === "slide")}
              onClick={() => setTargetType("slide")}
            >
              {t("pptx.hyperlink.tabSlide")}
            </button>
            <button
              type="button"
              className={tabCls(targetType === "file")}
              onClick={() => setTargetType("file")}
            >
              {t("pptx.hyperlink.tabFile")}
            </button>
            <button
              type="button"
              className={tabCls(targetType === "action")}
              onClick={() => setTargetType("action")}
            >
              {t("pptx.hyperlink.tabAction")}
            </button>
          </div>

          {/* Body */}
          <HyperlinkTabContent
            targetType={targetType}
            url={url}
            setUrl={setUrl}
            tooltip={tooltip}
            setTooltip={setTooltip}
            emailAddress={emailAddress}
            setEmailAddress={setEmailAddress}
            emailSubject={emailSubject}
            setEmailSubject={setEmailSubject}
            slideNumber={slideNumber}
            setSlideNumber={setSlideNumber}
            slideCount={slideCount}
            filePath={filePath}
            setFilePath={setFilePath}
            actionVerb={actionVerb}
            setActionVerb={setActionVerb}
            inputRef={inputRef}
            inputCls={inputCls}
            onEnterConfirm={handleConfirm}
          />

          {/* Footer */}
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded border border-border text-foreground hover:bg-muted"
              onClick={onCancel}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleConfirm}
            >
              {t("common.apply")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
