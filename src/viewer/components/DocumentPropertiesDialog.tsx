import React, { useState, useCallback, useMemo } from "react";
import { LuFileText, LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";

import type {
  PptxAppProperties,
  PptxCoreProperties,
  PptxCustomProperty,
} from "../../core";
import { DocumentPropertiesCustomTab } from "./DocumentPropertiesCustomTab";
import { DocumentPropertiesStatisticsTab } from "./DocumentPropertiesStatisticsTab";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentPropertiesDialogProps {
  isOpen: boolean;
  coreProperties: PptxCoreProperties;
  customProperties: PptxCustomProperty[];
  appProperties?: PptxAppProperties;
  onClose: () => void;
  onSave: (
    core: PptxCoreProperties,
    custom: PptxCustomProperty[],
    app?: Partial<PptxAppProperties>,
  ) => void;
}

type TabId = "summary" | "custom" | "statistics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUMMARY_FIELDS: Array<{
  key: keyof PptxCoreProperties;
  labelKey: string;
  multiline?: boolean;
}> = [
  { key: "title", labelKey: "pptx.documentProperties.summary.title" },
  { key: "subject", labelKey: "pptx.documentProperties.summary.subject" },
  { key: "creator", labelKey: "pptx.documentProperties.summary.author" },
  { key: "keywords", labelKey: "pptx.documentProperties.summary.keywords" },
  {
    key: "description",
    labelKey: "pptx.documentProperties.summary.description",
    multiline: true,
  },
  { key: "category", labelKey: "pptx.documentProperties.summary.category" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentPropertiesDialog({
  isOpen,
  coreProperties,
  customProperties,
  appProperties,
  onClose,
  onSave,
}: DocumentPropertiesDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [draftCore, setDraftCore] = useState<PptxCoreProperties>({});
  const [draftCustom, setDraftCustom] = useState<PptxCustomProperty[]>([]);
  const [draftApp, setDraftApp] = useState<Partial<PptxAppProperties>>({});

  // Sync draft state when dialog opens
  const [prevOpen, setPrevOpen] = useState(false);
  if (isOpen && !prevOpen) {
    setDraftCore({ ...coreProperties });
    setDraftCustom(customProperties.map((p) => ({ ...p })));
    setDraftApp({
      company: appProperties?.company,
      manager: appProperties?.manager,
    });
    setActiveTab("summary");
  }
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
  }

  const handleCoreFieldChange = useCallback(
    (key: keyof PptxCoreProperties, value: string) => {
      setDraftCore((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const isDirty = useMemo(() => {
    const coreChanged = SUMMARY_FIELDS.some(
      ({ key }) => (draftCore[key] ?? "") !== (coreProperties[key] ?? ""),
    );
    if (coreChanged) return true;
    const appCompanyChanged =
      (draftApp.company ?? "") !== (appProperties?.company ?? "");
    const appManagerChanged =
      (draftApp.manager ?? "") !== (appProperties?.manager ?? "");
    if (appCompanyChanged || appManagerChanged) return true;
    if (draftCustom.length !== customProperties.length) return true;
    return draftCustom.some(
      (p, i) =>
        p.name !== customProperties[i]?.name ||
        p.value !== customProperties[i]?.value ||
        p.type !== customProperties[i]?.type,
    );
  }, [
    draftCore,
    draftCustom,
    draftApp,
    coreProperties,
    customProperties,
    appProperties,
  ]);

  const handleUpdateDraftApp = useCallback(
    (updates: Partial<PptxAppProperties>) => {
      setDraftApp((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  const handleSave = useCallback(() => {
    const appChanged =
      (draftApp.company ?? "") !== (appProperties?.company ?? "") ||
      (draftApp.manager ?? "") !== (appProperties?.manager ?? "");
    onSave(draftCore, draftCustom, appChanged ? draftApp : undefined);
    onClose();
  }, [draftCore, draftCustom, draftApp, appProperties, onSave, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const TABS: Array<{ id: TabId; labelKey: string }> = [
    { id: "summary", labelKey: "pptx.documentProperties.tabs.summary" },
    { id: "custom", labelKey: "pptx.documentProperties.tabs.custom" },
    { id: "statistics", labelKey: "pptx.documentProperties.tabs.statistics" },
  ];

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/60"
        aria-label={t("common.close")}
        onClick={handleClose}
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-[520px] rounded-xl border border-border bg-popover backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <LuFileText className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                {t("pptx.documentProperties.dialogTitle")}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded hover:bg-accent transition-colors"
              aria-label={t("common.close")}
            >
              <LuX className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border/60">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="px-5 py-4 min-h-[280px]">
            {activeTab === "summary" && (
              <div className="space-y-3">
                {SUMMARY_FIELDS.map(({ key, labelKey, multiline }) => (
                  <div key={key}>
                    <label className="block text-xs text-foreground mb-1">
                      {t(labelKey)}
                    </label>
                    {multiline ? (
                      <textarea
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                        rows={3}
                        value={draftCore[key] ?? ""}
                        onChange={(e) =>
                          handleCoreFieldChange(key, e.target.value)
                        }
                      />
                    ) : (
                      <input
                        type="text"
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={draftCore[key] ?? ""}
                        onChange={(e) =>
                          handleCoreFieldChange(key, e.target.value)
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "custom" && (
              <DocumentPropertiesCustomTab
                customProperties={draftCustom}
                onUpdate={setDraftCustom}
              />
            )}

            {activeTab === "statistics" && (
              <DocumentPropertiesStatisticsTab
                appProperties={{
                  ...(appProperties ?? {}),
                  company: draftApp.company,
                  manager: draftApp.manager,
                }}
                onUpdateAppProperties={handleUpdateDraftApp}
                canEdit={true}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/60">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty}
              className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
