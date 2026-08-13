/**
 * @fileoverview "Is there a recoverable snapshot for this deck, and what should
 * the prompt say?"
 *
 * Every binding writes crash-recovery snapshots into the shared IndexedDB store
 * (`./autosave-store`). Until now only React ever looked for one again, and
 * even it merely popped the Version History panel open, which never says the
 * word "recover". In the other four the data was there and nothing surfaced it,
 * so the feature was invisible: the user closed a crashed tab, reopened the
 * deck, and silently got the pre-crash version back.
 *
 * The decision lives here as one pure function so all five ask the same
 * questions in the same order, and each binding does nothing but render the
 * descriptor as its own dialog.
 *
 * ## Why a "consumed" marker exists
 *
 * A host can restore the snapshot itself: `restoreSessionDeck` prefers a newer
 * autosave snapshot over the bytes a tab was opened with, which is exactly what
 * the demo apps do on reload. The viewer is then handed the snapshot's own
 * bytes and must NOT turn round and offer to recover them, or every refresh
 * mid-edit would raise a dialog about the content already on screen.
 *
 * Timestamps cannot settle that on their own: after a genuine crash the fresh
 * load is also newer than the snapshot, so "the snapshot is older than this
 * load" would suppress the one prompt that matters. Instead the consumer of a
 * snapshot records it, per tab, in `sessionStorage`: surviving a reload (where
 * the host already restored) but not a new tab (where a crash recovery is
 * exactly what the user wants to be asked about).
 *
 * @module render/autosave-recovery
 */

import { deleteAutosaveSnapshot, getAutosaveSnapshot } from './autosave-store';
import type { AutosaveRecord } from './autosave-store';

/** Snapshots older than this are not offered: the session they belong to is gone. */
export const AUTOSAVE_RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** `sessionStorage` key holding the newest snapshot timestamp this tab has consumed. */
const CONSUMED_KEY = 'pptx-viewer-recovery-consumed';

// ---------------------------------------------------------------------------
// Consumed marker
// ---------------------------------------------------------------------------

/**
 * Record that this tab has already taken delivery of the snapshot written at
 * `timestamp`, whether the host restored it (`restoreSessionDeck`) or the user
 * accepted the prompt. Best-effort: a partitioned or disabled `sessionStorage`
 * simply means the prompt may be offered once more.
 */
export function markAutosaveSnapshotConsumed(timestamp: number): void {
	try {
		if (typeof sessionStorage === 'undefined' || !Number.isFinite(timestamp)) {
			return;
		}
		const previous = consumedAutosaveSnapshotTimestamp();
		if (timestamp > previous) {
			sessionStorage.setItem(CONSUMED_KEY, String(timestamp));
		}
	} catch {
		// Storage unavailable: the prompt stays offerable, which is the safe side.
	}
}

/** The newest snapshot timestamp this tab has consumed, or 0. */
export function consumedAutosaveSnapshotTimestamp(): number {
	try {
		if (typeof sessionStorage === 'undefined') {
			return 0;
		}
		const raw = sessionStorage.getItem(CONSUMED_KEY);
		const value = raw === null ? Number.NaN : Number(raw);
		return Number.isFinite(value) ? value : 0;
	} catch {
		return 0;
	}
}

// ---------------------------------------------------------------------------
// Probe guard
// ---------------------------------------------------------------------------

export interface AutosaveRecoveryProbeInput {
	/** This load has already been probed (the check is once per loaded deck). */
	readonly alreadyChecked: boolean;
	/** The IndexedDB key. Nothing to look up without one. */
	readonly filePath: string | undefined;
	/** True while the load pipeline is running. */
	readonly loading: boolean;
	/** A load error; a deck that failed to open cannot be compared to a snapshot. */
	readonly error: string | null | undefined;
	/** Slides currently rendered. Zero means nothing opened. */
	readonly slideCount: number;
	/**
	 * Whether recovery autosave is permitted at all (see
	 * `resolveAutosaveActivation`). A host that switched autosave off is not
	 * offered snapshots a previous configuration left behind.
	 */
	readonly autosaveAllowed: boolean;
}

/** True when it is worth going to IndexedDB for a snapshot. */
export function shouldProbeAutosaveRecovery(input: AutosaveRecoveryProbeInput): boolean {
	return (
		!input.alreadyChecked &&
		input.autosaveAllowed &&
		Boolean(input.filePath) &&
		!input.loading &&
		!input.error &&
		input.slideCount > 0
	);
}

// ---------------------------------------------------------------------------
// Prompt descriptor
// ---------------------------------------------------------------------------

/** Everything a binding needs to render the recovery dialog, and nothing else. */
export interface AutosaveRecoveryPrompt {
	/** IndexedDB key the snapshot is stored under (the deck's file path/name). */
	readonly filePath: string;
	/** When the snapshot was written (epoch ms). */
	readonly timestamp: number;
	/** Snapshot size in bytes. */
	readonly size: number;
	/** Whole minutes since it was written, floored at 0. */
	readonly ageMinutes: number;
	readonly titleKey: string;
	readonly messageKey: string;
	/** `size` is pre-formatted here because byte units are not translated. */
	readonly messageParams: { readonly file: string; readonly size: string };
	/** Relative age, reusing the existing autosave age keys. */
	readonly ageKey: string;
	readonly ageParams: { readonly count: number };
	readonly restoreKey: string;
	readonly discardKey: string;
}

export interface AutosaveRecoveryPromptInput {
	/** The stored snapshot, or undefined when there is none. */
	readonly record: { key: string; timestamp: number; size: number } | undefined;
	/** Now, epoch ms. */
	readonly now: number;
	/** Newest snapshot this tab already took delivery of (see the module docstring). */
	readonly consumedTimestamp?: number;
}

/** Format a snapshot size without translating it: "812 KB", "1.2 MB". */
export function formatSnapshotSize(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return '0 KB';
	}
	if (bytes < 1024 * 1024) {
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Which relative-age key describes `ageMinutes`. */
function ageKeyFor(ageMinutes: number): { key: string; count: number } {
	if (ageMinutes < 1) {
		return { key: 'pptx.autosave.justNow', count: 0 };
	}
	if (ageMinutes === 1) {
		return { key: 'pptx.autosave.oneMinAgo', count: 1 };
	}
	if (ageMinutes < 60) {
		return { key: 'pptx.autosave.minutesAgo', count: ageMinutes };
	}
	return { key: 'pptx.autosave.recovery.hoursAgo', count: Math.floor(ageMinutes / 60) };
}

/**
 * The prompt to show, or null when there is nothing worth offering.
 *
 * Rejects, in order: no record, an empty record, one older than the recovery
 * window, and one this tab has already consumed.
 */
export function autosaveRecoveryPrompt(
	input: AutosaveRecoveryPromptInput,
): AutosaveRecoveryPrompt | null {
	const record = input.record;
	if (!record || record.size <= 0 || !record.key) {
		return null;
	}
	const age = input.now - record.timestamp;
	if (!Number.isFinite(age) || age < 0 || age >= AUTOSAVE_RECOVERY_WINDOW_MS) {
		return null;
	}
	if (record.timestamp <= (input.consumedTimestamp ?? 0)) {
		return null;
	}
	const ageMinutes = Math.floor(age / 60_000);
	const relative = ageKeyFor(ageMinutes);
	return {
		filePath: record.key,
		timestamp: record.timestamp,
		size: record.size,
		ageMinutes,
		titleKey: 'pptx.autosave.recovery.title',
		messageKey: 'pptx.autosave.recovery.message',
		messageParams: { file: record.key, size: formatSnapshotSize(record.size) },
		ageKey: relative.key,
		ageParams: { count: relative.count },
		restoreKey: 'pptx.autosave.recovery.restore',
		discardKey: 'pptx.autosave.recovery.discard',
	};
}

// ---------------------------------------------------------------------------
// When may the offer be on screen?
// ---------------------------------------------------------------------------

export interface AutosaveRecoveryVisibilityInput {
	/** The descriptor the probe produced, if any. */
	readonly prompt: AutosaveRecoveryPrompt | null | undefined;
	/** Whether a slide show is running. */
	readonly presenting: boolean;
}

/**
 * Whether the recovery prompt may be mounted right now.
 *
 * A running slide show has no editor chrome: every editor region must leave the
 * layout, the focus order AND the accessibility tree, and an overlay that merely
 * looks absent does not qualify. This prompt is editor chrome by that
 * definition, and it is also modal, so leaving it mounted puts a full-area
 * backdrop over the show that swallows action-button clicks. That was measured,
 * not theorised: `<div data-pptx-autosave-recovery> intercepts pointer events`
 * is what the click log said.
 *
 * The offer is DEFERRED, not dropped. The probe result is kept, so the prompt
 * appears the moment the show ends. Interrupting someone's presentation with a
 * modal about crash recovery is a worse outcome than answering it a few minutes
 * later, and the snapshot is not going anywhere.
 *
 * Note the deliberate non-fix: making the overlay pointer-transparent instead.
 * A modal that does not take the pointer is a lie (its own buttons stop being
 * clickable), and it would still sit in the accessibility tree during the show.
 */
export function shouldShowAutosaveRecoveryPrompt(input: AutosaveRecoveryVisibilityInput): boolean {
	return Boolean(input.prompt) && !input.presenting;
}

// ---------------------------------------------------------------------------
// The async plumbing, written once instead of five times
// ---------------------------------------------------------------------------

export interface AutosaveRecoveryOffer {
	readonly prompt: AutosaveRecoveryPrompt;
	readonly record: AutosaveRecord;
}

/**
 * Look up the snapshot for `filePath` and decide whether to offer it.
 *
 * Never throws: a blocked or missing IndexedDB is "nothing to recover".
 */
export async function probeAutosaveRecovery(
	filePath: string,
	now: number = Date.now(),
): Promise<AutosaveRecoveryOffer | null> {
	if (typeof indexedDB === 'undefined') {
		return null;
	}
	try {
		const record = await getAutosaveSnapshot(filePath);
		const prompt = autosaveRecoveryPrompt({
			record: record
				? { key: record.key, timestamp: record.timestamp, size: record.size }
				: undefined,
			now,
			consumedTimestamp: consumedAutosaveSnapshotTimestamp(),
		});
		if (!prompt || !record) {
			return null;
		}
		return { prompt, record };
	} catch {
		return null;
	}
}

/**
 * The user accepted: mark the snapshot consumed so the same tab does not offer
 * it again, and hand back the bytes for the binding to load.
 */
export function acceptAutosaveRecovery(record: AutosaveRecord): Uint8Array {
	markAutosaveSnapshotConsumed(record.timestamp);
	return record.data instanceof Uint8Array ? record.data : new Uint8Array(record.data);
}

/**
 * The user declined: drop the snapshot. Deliberately destructive, because
 * "Discard" that leaves the file behind would ask again in the next tab, and
 * the editor's own autosave writes a fresh one the moment they edit anything.
 */
export async function discardAutosaveRecovery(record: {
	key: string;
	timestamp: number;
}): Promise<void> {
	markAutosaveSnapshotConsumed(record.timestamp);
	try {
		await deleteAutosaveSnapshot(record.key);
	} catch {
		// Best-effort: the marker already stops this tab re-offering it.
	}
}
