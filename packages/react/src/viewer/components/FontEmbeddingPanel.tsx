import React, { useState, useCallback, useEffect } from "react";
import { LuType, LuX, LuCheck, LuLoader } from "react-icons/lu";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FontFileInfo {
  family: string;
  filePath: string;
  style: string;
}

interface PptxSecurityElectronApi {
  pptxSecurity: {
    findSystemFonts: (families: string[]) => Promise<FontFileInfo[]>;
    readFontFile: (fontFilePath: string) => Promise<Uint8Array | null>;
  };
}

export interface FontEmbeddingPanelProps {
  isOpen: boolean;
  embedFontsEnabled: boolean;
  usedFontFamilies: string[];
  embeddedFonts: string[];
  onClose: () => void;
  onToggleEmbedFonts: (enabled: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getElectronApi(): PptxSecurityElectronApi | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, unknown>;
  if (w["electron"]) return w["electron"] as PptxSecurityElectronApi;
  return undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FontEmbeddingPanel({
  isOpen,
  embedFontsEnabled,
  usedFontFamilies,
  embeddedFonts,
  onClose,
  onToggleEmbedFonts,
}: FontEmbeddingPanelProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [foundFonts, setFoundFonts] = useState<FontFileInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const scanFonts = useCallback(async () => {
    const api = getElectronApi();
    if (!api) return;
    setScanning(true);
    try {
      const results = await api.pptxSecurity.findSystemFonts(usedFontFamilies);
      setFoundFonts(results);
      setScanned(true);
    } catch {
      // silently fail
    } finally {
      setScanning(false);
    }
  }, [usedFontFamilies]);

  useEffect(() => {
    if (isOpen && !scanned) {
      scanFonts();
    }
  }, [isOpen, scanned, scanFonts]);

  if (!isOpen) return null;

  // Deduplicate by family name
  const familySet = new Set(foundFonts.map((f) => f.family));
  const missingFamilies = usedFontFamilies.filter((f) => !familySet.has(f));
  const embeddedSet = new Set(embeddedFonts);

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/60"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[460px] max-h-[80vh] rounded-xl border border-border bg-popover backdrop-blur-xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 shrink-0">
            <div className="flex items-center gap-2">
              <LuType className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                {t("pptx.fonts.embedFonts")}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-accent transition-colors"
              aria-label={t("common.close")}
            >
              <LuX className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            <p className="text-xs text-muted-foreground">
              {t("pptx.fonts.embedDescription")}
            </p>

            {/* Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={embedFontsEnabled}
                  onChange={(e) => onToggleEmbedFonts(e.target.checked)}
                />
                <div
                  className={`w-9 h-5 rounded-full transition-colors ${
                    embedFontsEnabled ? "bg-primary" : "bg-muted-foreground"
                  }`}
                />
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    embedFontsEnabled ? "translate-x-4" : ""
                  }`}
                />
              </div>
              <span className="text-xs text-foreground">
                {t("pptx.fonts.enableEmbedding")}
              </span>
            </label>

            {/* Font list */}
            <div className="space-y-1">
              <h3 className="text-xs font-medium text-foreground">
                {t("pptx.fonts.usedFonts")} ({usedFontFamilies.length})
              </h3>
              {scanning ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <LuLoader className="w-4 h-4 text-muted-foreground animate-spin" />
                  <span className="text-xs text-muted-foreground">
                    {t("pptx.fonts.scanning")}
                  </span>
                </div>
              ) : (
                <div className="space-y-1 max-h-[280px] overflow-y-auto">
                  {usedFontFamilies.map((family) => {
                    const found = familySet.has(family);
                    const embedded = embeddedSet.has(family);
                    return (
                      <div
                        key={family}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/60"
                      >
                        <span className="text-xs text-foreground">
                          {family}
                        </span>
                        <div className="flex items-center gap-2">
                          {embedded && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-700/40">
                              {t("pptx.fonts.embedded")}
                            </span>
                          )}
                          {found ? (
                            <LuCheck className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <span className="text-[10px] text-yellow-400">
                              {t("pptx.fonts.notFound")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {missingFamilies.length > 0 && !scanning && (
              <p className="text-[11px] text-yellow-400/80">
                {t("pptx.fonts.missingWarning", {
                  count: missingFamilies.length,
                })}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-5 py-3 border-t border-border/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/80 transition-colors"
            >
              {t("common.done")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
