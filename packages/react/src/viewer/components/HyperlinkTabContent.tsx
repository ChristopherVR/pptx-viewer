import React from "react";
import { useTranslation } from "react-i18next";

import type {
  HyperlinkTargetType,
  HyperlinkActionVerb,
} from "./hyperlink-edit-types";

/**
 * Props for the {@link HyperlinkTabContent} component.
 *
 * All field values and setters are lifted from the parent
 * {@link HyperlinkEditDialog} to keep the tab body stateless.
 */
export interface HyperlinkTabContentProps {
  targetType: HyperlinkTargetType;
  url: string;
  setUrl: (value: string) => void;
  tooltip: string;
  setTooltip: (value: string) => void;
  emailAddress: string;
  setEmailAddress: (value: string) => void;
  emailSubject: string;
  setEmailSubject: (value: string) => void;
  slideNumber: number;
  setSlideNumber: (value: number) => void;
  slideCount: number;
  filePath: string;
  setFilePath: (value: string) => void;
  actionVerb: HyperlinkActionVerb;
  setActionVerb: (value: HyperlinkActionVerb) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  inputCls: string;
  onEnterConfirm: () => void;
}

/**
 * Renders the body content for the active hyperlink tab.
 *
 * Conditionally shows the appropriate input fields for the selected
 * `targetType` (URL input, email + subject fields, slide number picker,
 * file path input, or action verb dropdown). A shared tooltip field
 * is always rendered at the bottom.
 *
 * @param props - {@link HyperlinkTabContentProps}
 * @returns The rendered tab content.
 */
export function HyperlinkTabContent({
  targetType,
  url,
  setUrl,
  tooltip,
  setTooltip,
  emailAddress,
  setEmailAddress,
  emailSubject,
  setEmailSubject,
  slideNumber,
  setSlideNumber,
  slideCount,
  filePath,
  setFilePath,
  actionVerb,
  setActionVerb,
  inputRef,
  inputCls,
  onEnterConfirm,
}: HyperlinkTabContentProps): React.ReactElement {
  const { t } = useTranslation();

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onEnterConfirm();
  };

  return (
    <div className="px-4 py-3 space-y-3">
      {targetType === "url" && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            {t("pptx.hyperlink.urlLabel")}
          </label>
          <input
            ref={inputRef}
            type="url"
            className={inputCls}
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleEnterKey}
          />
        </div>
      )}

      {targetType === "email" && (
        <>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {t("pptx.hyperlink.emailLabel")}
            </label>
            <input
              ref={inputRef}
              type="email"
              className={inputCls}
              placeholder="user@example.com"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              onKeyDown={handleEnterKey}
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {t("pptx.hyperlink.subjectLabel")}
            </label>
            <input
              type="text"
              className={inputCls}
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>
        </>
      )}

      {targetType === "slide" && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            {t("pptx.hyperlink.slideLabel")}
          </label>
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={slideCount}
            className={inputCls}
            value={slideNumber}
            onChange={(e) => setSlideNumber(parseInt(e.target.value, 10) || 1)}
            onKeyDown={handleEnterKey}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            {t("pptx.hyperlink.slideRange", { max: slideCount })}
          </p>
        </div>
      )}

      {targetType === "file" && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            {t("pptx.hyperlink.fileLabel")}
          </label>
          <input
            ref={inputRef}
            type="text"
            className={inputCls}
            placeholder="../documents/file.docx"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            onKeyDown={handleEnterKey}
          />
        </div>
      )}

      {targetType === "action" && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            {t("pptx.hyperlink.actionLabel")}
          </label>
          <select
            className={inputCls}
            value={actionVerb}
            onChange={(e) =>
              setActionVerb(e.target.value as HyperlinkActionVerb)
            }
          >
            <option value="nextSlide">
              {t("pptx.hyperlink.actionNextSlide")}
            </option>
            <option value="prevSlide">
              {t("pptx.hyperlink.actionPrevSlide")}
            </option>
            <option value="firstSlide">
              {t("pptx.hyperlink.actionFirstSlide")}
            </option>
            <option value="lastSlide">
              {t("pptx.hyperlink.actionLastSlide")}
            </option>
            <option value="endShow">{t("pptx.hyperlink.actionEndShow")}</option>
          </select>
        </div>
      )}

      {/* Tooltip — shared across all types */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">
          {t("pptx.hyperlink.tooltipLabel")}
        </label>
        <input
          type="text"
          className={inputCls}
          value={tooltip}
          onChange={(e) => setTooltip(e.target.value)}
        />
      </div>
    </div>
  );
}
