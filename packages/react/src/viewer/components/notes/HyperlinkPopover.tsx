import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/* ------------------------------------------------------------------ */
/*  Hyperlink Popover                                                  */
/* ------------------------------------------------------------------ */

export function HyperlinkPopover({
  initialText,
  onInsert,
  onClose,
}: {
  initialText: string;
  onInsert: (url: string, displayText: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [displayText, setDisplayText] = useState(initialText);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (url.trim().length === 0) return;
      const finalUrl = url.startsWith("http") ? url : `https://${url}`;
      onInsert(finalUrl, displayText || finalUrl);
    },
    [url, displayText, onInsert],
  );

  return (
    <div className="absolute bottom-full left-0 mb-1 z-10 bg-muted border border-border rounded-lg shadow-lg p-3 w-72">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">
            {t("pptx.notes.linkUrl")}
          </label>
          <input
            ref={urlRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-2 py-1 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground mb-0.5">
            {t("pptx.notes.linkDisplayText")}
          </label>
          <input
            type="text"
            value={displayText}
            onChange={(e) => setDisplayText(e.target.value)}
            placeholder={t("pptx.notes.linkDisplayText")}
            className="w-full px-2 py-1 text-xs bg-background border border-border rounded text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="px-2 py-1 text-[10px] bg-primary hover:bg-primary/80 text-white rounded"
          >
            {t("pptx.notes.insertLink")}
          </button>
        </div>
      </form>
    </div>
  );
}
