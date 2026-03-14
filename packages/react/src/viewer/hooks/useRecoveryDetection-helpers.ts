/**
 * Pure helper functions extracted from useRecoveryDetection for testability.
 */

// ---------------------------------------------------------------------------
// Guard: should we even attempt a recovery check?
// ---------------------------------------------------------------------------

export interface RecoveryCheckInput {
  alreadyChecked: boolean;
  filePath: string | undefined;
  loading: boolean;
  error: string | null;
  slideCount: number;
}

/**
 * Returns true when all preconditions for a recovery check are met:
 * - Not previously checked
 * - A filePath is available
 * - Not currently loading
 * - No error present
 * - At least one slide loaded
 */
export function shouldCheckRecovery(input: RecoveryCheckInput): boolean {
  const { alreadyChecked, filePath, loading, error, slideCount } = input;
  if (alreadyChecked) return false;
  if (!filePath) return false;
  if (loading) return false;
  if (error) return false;
  if (slideCount === 0) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Recovery freshness check
// ---------------------------------------------------------------------------

/** How recent (in ms) a recovery version must be to trigger the prompt. */
export const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns true when the given timestamp is within the recovery window
 * relative to `now`.
 */
export function isRecentRecovery(timestamp: number, now: number): boolean {
  return now - timestamp < RECOVERY_WINDOW_MS;
}

/**
 * Given a list of recovery versions, determine whether the most recent one
 * is fresh enough to warrant prompting the user.
 * Versions are expected to be sorted most-recent-first.
 */
export function hasRecentRecoveryVersion(
  versions: Array<{ timestamp: number }>,
  now: number,
): boolean {
  if (versions.length === 0) return false;
  return isRecentRecovery(versions[0].timestamp, now);
}
