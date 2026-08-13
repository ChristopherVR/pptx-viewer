/**
 * useRecoveryDetection: after a deck finishes loading, ask the shared recovery
 * store whether a NEWER crash-recovery snapshot exists for it, and hand the
 * caller a prompt descriptor to render.
 *
 * It used to open the Version History panel instead, which never says the word
 * "recover" and left the user to work out what they were looking at. The panel
 * is still opened alongside the prompt when the caller wants it, but the
 * decision and the copy now come from `pptx-viewer-shared`
 * (`render/autosave-recovery`), so the other four bindings render the same
 * dialog from the same descriptor.
 */
import {
	acceptAutosaveRecovery,
	discardAutosaveRecovery,
	probeAutosaveRecovery,
	shouldProbeAutosaveRecovery,
} from 'pptx-viewer-shared';
import type { AutosaveRecord, AutosaveRecoveryPrompt } from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Input / output
// ---------------------------------------------------------------------------

export interface UseRecoveryDetectionInput {
	filePath: string | undefined;
	loading: boolean;
	error: string | null;
	slideCount: number;
	/**
	 * Whether the host permits autosave (the shared `resolveAutosaveActivation`
	 * ceiling). A host that passed `autosave={false}` is never offered snapshots
	 * an earlier configuration left behind. Defaults to true.
	 */
	autosaveAllowed?: boolean;
	/** Load the recovered bytes into the viewer. */
	onRestore?: (bytes: Uint8Array) => void;
	/** Legacy behaviour: also open the Version History panel when one is found. */
	openVersionHistory?: () => void;
}

export interface UseRecoveryDetectionResult {
	/** What the dialog should say, or null when there is nothing to offer. */
	prompt: AutosaveRecoveryPrompt | null;
	/** Accept: load the snapshot and close. */
	restore: () => void;
	/** Decline: drop the snapshot and close. */
	discard: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecoveryDetection(input: UseRecoveryDetectionInput): UseRecoveryDetectionResult {
	const { filePath, loading, error, slideCount, autosaveAllowed = true } = input;
	const recoveryCheckedRef = useRef(false);
	const recordRef = useRef<AutosaveRecord | null>(null);
	const [prompt, setPrompt] = useState<AutosaveRecoveryPrompt | null>(null);

	const onRestore = input.onRestore;
	const openVersionHistory = input.openVersionHistory;

	useEffect(() => {
		if (
			!shouldProbeAutosaveRecovery({
				alreadyChecked: recoveryCheckedRef.current,
				filePath,
				loading,
				error,
				slideCount,
				autosaveAllowed,
			})
		) {
			return;
		}
		recoveryCheckedRef.current = true;

		void (async () => {
			const offer = await probeAutosaveRecovery(filePath!);
			if (!offer) {
				return;
			}
			recordRef.current = offer.record;
			setPrompt(offer.prompt);
			openVersionHistory?.();
		})();
	}, [filePath, loading, error, slideCount, autosaveAllowed, openVersionHistory]);

	const restore = useCallback(() => {
		const record = recordRef.current;
		setPrompt(null);
		if (record && onRestore) {
			onRestore(acceptAutosaveRecovery(record));
		}
		recordRef.current = null;
	}, [onRestore]);

	const discard = useCallback(() => {
		const record = recordRef.current;
		setPrompt(null);
		recordRef.current = null;
		if (record) {
			void discardAutosaveRecovery(record);
		}
	}, []);

	return { prompt, restore, discard };
}
