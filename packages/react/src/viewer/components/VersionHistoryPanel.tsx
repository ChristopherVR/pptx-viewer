import React, { useCallback, useEffect, useState } from "react";
import { LuClock, LuDownload, LuTrash2, LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecoveryVersion {
  fileName: string;
  filePath: string;
  timestamp: number;
  size: number;
}

export interface VersionHistoryPanelProps {
  isOpen: boolean;
  filePath: string | undefined;
  onClose: () => void;
  onRestore: (versionData: Uint8Array) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PptxRecoveryElectronApi {
  pptxRecovery: {
    getVersions: (sourceFilePath: string) => Promise<RecoveryVersion[]>;
    restoreVersion: (
      sourceFilePath: string,
      versionPath: string,
    ) => Promise<Uint8Array | null>;
    deleteVersion: (
      sourceFilePath: string,
      versionPath: string,
    ) => Promise<boolean>;
  };
}

function getElectronApi(): PptxRecoveryElectronApi | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, unknown>;
  if (w["electron"]) {
    return w["electron"] as PptxRecoveryElectronApi;
  }
  return undefined;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VersionHistoryPanel({
  isOpen,
  filePath,
  onClose,
  onRestore,
}: VersionHistoryPanelProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [versions, setVersions] = useState<RecoveryVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringPath, setRestoringPath] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  // ── Fetch versions ──────────────────────────────────────────────
  const fetchVersions = useCallback(async () => {
    const api = getElectronApi();
    if (!api?.pptxRecovery || !filePath) return;
    setLoading(true);
    try {
      const result = await api.pptxRecovery.getVersions(filePath);
      setVersions(result);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    if (isOpen) {
      void fetchVersions();
    }
  }, [isOpen, fetchVersions]);

  // ── Restore ─────────────────────────────────────────────────────
  const handleRestore = useCallback(
    async (version: RecoveryVersion) => {
      const api = getElectronApi();
      if (!api?.pptxRecovery || !filePath) return;
      setRestoringPath(version.filePath);
      try {
        const data = await api.pptxRecovery.restoreVersion(
          filePath,
          version.filePath,
        );
        if (data) {
          onRestore(data);
          onClose();
        }
      } finally {
        setRestoringPath(null);
      }
    },
    [filePath, onRestore, onClose],
  );

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (version: RecoveryVersion) => {
      const api = getElectronApi();
      if (!api?.pptxRecovery || !filePath) return;
      setDeletingPath(version.filePath);
      try {
        await api.pptxRecovery.deleteVersion(filePath, version.filePath);
        await fetchVersions();
      } finally {
        setDeletingPath(null);
      }
    },
    [filePath, fetchVersions],
  );

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-80 bg-background border-l border-border z-50 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <LuClock className="w-4 h-4" />
          {t("pptx.versionHistory.title")}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        >
          <LuX className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {t("common.loading")}
          </div>
        )}

        {!loading && versions.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            {t("pptx.versionHistory.noVersions")}
          </div>
        )}

        {!loading &&
          versions.map((version) => (
            <div
              key={version.filePath}
              className="px-3 py-2.5 border-b border-border hover:bg-muted/50 group"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-foreground">
                  {formatTimestamp(version.timestamp)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(version.timestamp)}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {formatFileSize(version.size)}
              </div>
              <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => void handleRestore(version)}
                  disabled={restoringPath === version.filePath}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40"
                >
                  <LuDownload className="w-3 h-3" />
                  {restoringPath === version.filePath
                    ? t("common.loading")
                    : t("pptx.versionHistory.restore")}
                </button>
                <button
                  onClick={() => void handleDelete(version)}
                  disabled={deletingPath === version.filePath}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-40"
                >
                  <LuTrash2 className="w-3 h-3" />
                  {t("common.delete")}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
