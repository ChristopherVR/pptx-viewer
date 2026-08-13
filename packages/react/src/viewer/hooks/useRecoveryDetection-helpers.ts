/**
 * Thin shims over the shared crash-recovery decision.
 *
 * These pure helpers were React-only, which is exactly why only React ever
 * offered a recovery snapshot back to the user: the other four bindings wrote
 * snapshots and had nothing to consult. The logic now lives in
 * `pptx-viewer-shared` (`render/autosave-recovery`) and all five ask it the same
 * questions; these names stay so the React hook API does not churn.
 */

import { AUTOSAVE_RECOVERY_WINDOW_MS, shouldProbeAutosaveRecovery } from 'pptx-viewer-shared';

// ---------------------------------------------------------------------------
// Guard: should we even attempt a recovery check?
// ---------------------------------------------------------------------------

export interface RecoveryCheckInput {
	alreadyChecked: boolean;
	filePath: string | undefined;
	loading: boolean;
	error: string | null;
	slideCount: number;
	/** Whether the host permits autosave at all. Defaults to true (see the shim note). */
	autosaveAllowed?: boolean;
}

/**
 * Returns true when all preconditions for a recovery check are met:
 * - Not previously checked
 * - A filePath is available
 * - Not currently loading
 * - No error present
 * - At least one slide loaded
 * - The host has not switched autosave off
 */
export function shouldCheckRecovery(input: RecoveryCheckInput): boolean {
	return shouldProbeAutosaveRecovery({
		alreadyChecked: input.alreadyChecked,
		filePath: input.filePath,
		loading: input.loading,
		error: input.error,
		slideCount: input.slideCount,
		autosaveAllowed: input.autosaveAllowed ?? true,
	});
}

// ---------------------------------------------------------------------------
// Recovery freshness check
// ---------------------------------------------------------------------------

/** How recent (in ms) a recovery version must be to trigger the prompt. */
export const RECOVERY_WINDOW_MS = AUTOSAVE_RECOVERY_WINDOW_MS;

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
	if (versions.length === 0) {
		return false;
	}
	return isRecentRecovery(versions[0].timestamp, now);
}
