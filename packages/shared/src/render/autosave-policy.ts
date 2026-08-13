/**
 * @fileoverview Who decides whether recovery autosave runs, and how often.
 *
 * ## The rule: the host prop is a ceiling, the toggle is a preference
 *
 * Two things can speak about autosave, and until now each binding invented its
 * own answer for what happens when both do:
 *
 *  - the **host** passes an `autosave` prop. That is a POLICY: the embedder is
 *    stating what its application permits.
 *  - the **user** flips the title-bar AutoSave switch, or File > Options > Save
 *    > AutoSave. That is a PREFERENCE, expressed inside whatever the host allows.
 *
 * A preference can never exceed a policy, so:
 *
 *  - `autosave={false}` turns recovery autosave OFF and takes the toggle away
 *    (`toggleAvailable: false`). A user cannot switch on what the application
 *    forbade, and a switch that silently does nothing is worse than no switch.
 *  - `autosave={true}`, or the prop omitted entirely, PERMITS autosave. The
 *    user's toggle then decides, and it defaults to on.
 *
 * The prop is therefore only load-bearing when it is `false`. That is
 * deliberate: crash recovery that is off by default is crash recovery nobody
 * has, and the shared options schema already declares `save.autoSave: true` as
 * the user default, so any other prop default would contradict it. Vue, Svelte
 * and Vanilla previously defaulted to `false` and React and Angular to `true`;
 * `true` is the answer, and the three that defaulted off now write recovery
 * snapshots for hosts that never opted in. Pass `autosave={false}` to opt out.
 *
 * Two further gates are not negotiable by anyone, because without them there is
 * nothing to write or nowhere to write it: editing must be possible at all, and
 * a `filePath` must be set to key the IndexedDB record.
 *
 * ## Cadence follows the same rule
 *
 * An explicit `autosaveIntervalMs` prop is a policy and is honoured as given.
 * Otherwise the cadence is the user's own File > Options > Save > "Save
 * AutoRecover information every N minutes" (default two minutes), which React
 * and Angular already respected and the other three ignored.
 *
 * ## What the two engine shapes must agree on
 *
 * React and Angular POLL on a fixed interval; Vue, Svelte and Vanilla DEBOUNCE
 * on the edit. Both are legitimate, but a plain debounce has a failure mode a
 * poll does not: a user who keeps editing keeps re-arming the timer, so it can
 * defer a snapshot forever, and at the two-minute cadence that is an entire
 * session of lost work. {@link nextAutosaveDelayMs} caps the debounce so both
 * shapes make the same promise:
 *
 *   **a snapshot lands no later than one interval after the first unsaved edit,
 *   and no more often than once per interval.**
 *
 * @module render/autosave-policy
 */

import { AUTOSAVE_DEFAULT_INTERVAL_SECONDS, AUTOSAVE_MIN_INTERVAL_SECONDS } from './autosave-store';

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

/**
 * Why autosave is not running. `autosave_toggle_off` and `no_file_path` are the
 * codes the title bar has always understood; the other two are new and fall
 * back to the generic message in bindings that do not map them.
 */
export type AutosaveDisabledReason =
	| 'autosave_host_off'
	| 'autosave_toggle_off'
	| 'no_file_path'
	| 'read_only';

export interface AutosaveActivationInput {
	/**
	 * The host's `autosave` prop. `undefined` means the host said nothing, which
	 * is treated as "permitted" (see the module docstring).
	 */
	readonly hostAutosave?: boolean | undefined;
	/** The user preference: title-bar AutoSave toggle / Options > Save > AutoSave. */
	readonly userEnabled: boolean;
	/** Whether editing is possible at all. A read-only viewer has nothing to recover. */
	readonly canEdit: boolean;
	/** IndexedDB key for the snapshot. Without one there is nowhere to write. */
	readonly filePath: string | undefined;
}

export interface AutosaveActivation {
	/** Whether recovery snapshots should actually be written. */
	readonly active: boolean;
	/**
	 * Whether the user's AutoSave toggle can change anything. False only when
	 * the host passed `autosave={false}`; the toggle must then render off and
	 * inert rather than pretending to work.
	 */
	readonly toggleAvailable: boolean;
	/** Why it is inactive, for the title bar. `undefined` when active. */
	readonly reason?: AutosaveDisabledReason;
}

/**
 * Resolve the host policy and the user preference into one answer.
 *
 * Reason precedence is "most fundamental first": a host veto outranks the
 * toggle, which outranks a missing file path, which outranks read-only, so the
 * title bar names the thing the user would have to change first.
 */
export function resolveAutosaveActivation(input: AutosaveActivationInput): AutosaveActivation {
	if (input.hostAutosave === false) {
		return { active: false, toggleAvailable: false, reason: 'autosave_host_off' };
	}
	if (!input.userEnabled) {
		return { active: false, toggleAvailable: true, reason: 'autosave_toggle_off' };
	}
	if (!input.filePath) {
		return { active: false, toggleAvailable: true, reason: 'no_file_path' };
	}
	if (!input.canEdit) {
		return { active: false, toggleAvailable: true, reason: 'read_only' };
	}
	return { active: true, toggleAvailable: true };
}

/** i18n key for a disabled reason, for bindings that render the title-bar hint. */
export function autosaveDisabledReasonKey(reason: AutosaveDisabledReason | undefined): string {
	switch (reason) {
		case 'autosave_host_off':
			return 'pptx.autosave.disabledByHost';
		case 'autosave_toggle_off':
			return 'pptx.autosave.disabledToggleOff';
		case 'no_file_path':
			return 'pptx.autosave.disabledNoFilePath';
		case 'read_only':
			return 'pptx.autosave.disabledReadOnly';
		default:
			return 'pptx.autosave.disabled';
	}
}

// ---------------------------------------------------------------------------
// Cadence
// ---------------------------------------------------------------------------

/** The cadence every binding falls back to: the shared AutoRecover default. */
export const AUTOSAVE_DEFAULT_INTERVAL_MS = AUTOSAVE_DEFAULT_INTERVAL_SECONDS * 1000;

/**
 * Floor for a host-supplied interval. Far below the Options minimum on purpose:
 * an embedder asking for a two second debounce (the demos do) is making a
 * deliberate choice, and only a zero or negative value is meaningless.
 */
const HOST_INTERVAL_FLOOR_MS = 50;

export interface AutosaveIntervalInput {
	/** The host's `autosaveIntervalMs` prop, if it passed one. */
	readonly hostIntervalMs?: number | undefined;
	/**
	 * File > Options > Save > "Save AutoRecover information every N minutes",
	 * already converted to seconds (see `resolveAutosaveIntervalSeconds`).
	 */
	readonly optionsIntervalSeconds?: number | undefined;
}

/**
 * The interval to use, in milliseconds: the host's explicit prop, else the
 * user's AutoRecover cadence, else the shared default.
 */
export function resolveAutosaveIntervalMs(input: AutosaveIntervalInput): number {
	const host = input.hostIntervalMs;
	if (typeof host === 'number' && Number.isFinite(host)) {
		return Math.max(HOST_INTERVAL_FLOOR_MS, host);
	}
	const seconds = input.optionsIntervalSeconds;
	if (typeof seconds === 'number' && Number.isFinite(seconds)) {
		return Math.max(AUTOSAVE_MIN_INTERVAL_SECONDS, seconds) * 1000;
	}
	return AUTOSAVE_DEFAULT_INTERVAL_MS;
}

// ---------------------------------------------------------------------------
// Debounce ceiling (the promise the polling engines already keep)
// ---------------------------------------------------------------------------

export interface AutosaveDelayInput {
	/** The resolved interval. */
	readonly intervalMs: number;
	/**
	 * When the OLDEST still-unsaved edit happened (epoch ms), or null when the
	 * document is clean. Reset to null after each successful snapshot.
	 */
	readonly firstDirtyAt: number | null;
	/** Now, in epoch ms. */
	readonly now: number;
}

/**
 * How long a debouncing engine may wait before writing the next snapshot.
 *
 * The full interval when nothing is outstanding, otherwise whatever is left of
 * the first unsaved edit's interval, never negative. Continuous editing
 * therefore still produces a snapshot every interval instead of none at all.
 */
export function nextAutosaveDelayMs(input: AutosaveDelayInput): number {
	const interval = Math.max(0, input.intervalMs);
	if (input.firstDirtyAt === null) {
		return interval;
	}
	const remaining = input.firstDirtyAt + interval - input.now;
	return Math.min(interval, Math.max(0, remaining));
}
