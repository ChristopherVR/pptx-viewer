/**
 * useRecoveryDetection — Checks for recent crash-recovery versions on mount
 * and opens the version-history panel if a recovery file exists.
 */
import { useEffect, useRef } from "react";
import { shouldCheckRecovery, hasRecentRecoveryVersion } from "./useRecoveryDetection-helpers";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseRecoveryDetectionInput {
  filePath: string | undefined;
  loading: boolean;
  error: string | null;
  slideCount: number;
  openVersionHistory: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecoveryDetection(input: UseRecoveryDetectionInput): void {
  const { filePath, loading, error, slideCount, openVersionHistory } = input;
  const recoveryCheckedRef = useRef(false);

  useEffect(() => {
    if (
      !shouldCheckRecovery({
        alreadyChecked: recoveryCheckedRef.current,
        filePath,
        loading,
        error,
        slideCount,
      })
    ) {
      return;
    }
    recoveryCheckedRef.current = true;

    const w =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>)
        : undefined;
    const electronRef = w?.["electron"] as
      | {
          pptxRecovery?: {
            getVersions: (fp: string) => Promise<Array<{ timestamp: number }>>;
          };
        }
      | undefined;
    if (!electronRef?.pptxRecovery) return;
    const recoveryApi = electronRef.pptxRecovery;

    void (async () => {
      try {
        const versions = await recoveryApi.getVersions(filePath!);
        if (hasRecentRecoveryVersion(versions, Date.now())) {
          openVersionHistory();
        }
      } catch {
        // Silently ignore recovery check errors
      }
    })();
  }, [filePath, loading, error, slideCount, openVersionHistory]);
}
