/**
 * Pure helper functions extracted from useAutosave for testability.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default autosave interval in seconds. */
export const DEFAULT_AUTOSAVE_INTERVAL_SECONDS = 120;

/** Minimum allowed autosave interval in seconds. */
export const MIN_AUTOSAVE_INTERVAL_SECONDS = 10;

// ---------------------------------------------------------------------------
// Interval computation
// ---------------------------------------------------------------------------

/**
 * Compute the autosave interval in milliseconds from a user-supplied
 * interval in seconds, clamping to a minimum of 10 s.
 */
export function computeAutosaveIntervalMs(intervalSeconds: number): number {
  return Math.max(intervalSeconds, MIN_AUTOSAVE_INTERVAL_SECONDS) * 1000;
}

// ---------------------------------------------------------------------------
// Autosave guard
// ---------------------------------------------------------------------------

export interface CanAutosaveInput {
  enabled: boolean;
  filePath: string | undefined;
  isDirty: boolean;
  isSaving: boolean;
  hasElectronApi: boolean;
}

/**
 * Returns true when an autosave cycle should proceed.
 * All conditions must be met:
 * - autosave is enabled
 * - a filePath is available
 * - the document has unsaved changes
 * - no save is currently in progress
 * - the Electron recovery API is available
 */
export function canAutosave(input: CanAutosaveInput): boolean {
  const { enabled, filePath, isDirty, isSaving, hasElectronApi } = input;
  if (!enabled) return false;
  if (!filePath) return false;
  if (!isDirty) return false;
  if (isSaving) return false;
  if (!hasElectronApi) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Autosave status helpers
// ---------------------------------------------------------------------------

export type AutosaveState = "idle" | "saving" | "saved" | "error";

/**
 * Determine the display label for an autosave state.
 */
export function getAutosaveStatusLabel(state: AutosaveState): string {
  switch (state) {
    case "idle":
      return "Idle";
    case "saving":
      return "Saving...";
    case "saved":
      return "Saved";
    case "error":
      return "Error";
  }
}
