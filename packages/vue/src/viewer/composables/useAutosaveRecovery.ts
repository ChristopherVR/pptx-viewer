/**
 * useAutosaveRecovery: offer a crash-recovery snapshot back to the user.
 *
 * Vue wrote recovery snapshots and never looked for one again, so the feature
 * was invisible: a crashed tab reopened on the pre-crash deck with no hint that
 * newer work existed. The decision and the copy come from `pptx-viewer-shared`
 * (`render/autosave-recovery`); this composable only owns the reactivity.
 */
import {
	acceptAutosaveRecovery,
	acknowledgeAutosaveRecovery,
	discardAutosaveRecovery,
	probeAutosaveRecovery,
	shouldProbeAutosaveRecovery,
} from 'pptx-viewer-shared';
import type { AutosaveRecord, AutosaveRecoveryPrompt } from 'pptx-viewer-shared';
import { ref, watch } from 'vue';
import type { Ref } from 'vue';

export interface UseAutosaveRecoveryOptions {
	/** IndexedDB key of the open deck (file path, else file name). */
	filePath: () => string | undefined;
	/** Public document name rendered in the recovery message. */
	fileName: () => string | undefined;
	/** True while the load pipeline is running. */
	loading: Ref<boolean>;
	/** Load error, if any. */
	error: Ref<string | null | undefined>;
	/** Slides currently rendered. */
	slideCount: () => number;
	/**
	 * Whether the host permits autosave at all (`autosave` prop not `false`). A
	 * user who merely switched the toggle off is still offered a pre-crash
	 * snapshot; a host that forbade the feature is not.
	 */
	autosaveAllowed: () => boolean;
	/** Load the recovered bytes into the viewer. */
	onRestore: (bytes: Uint8Array) => void;
}

export interface UseAutosaveRecoveryResult {
	/** What the dialog should say, or null when there is nothing to offer. */
	prompt: Ref<AutosaveRecoveryPrompt | null>;
	discarding: Ref<boolean>;
	restore: () => void;
	discard: () => Promise<void>;
}

export function useAutosaveRecovery(
	options: UseAutosaveRecoveryOptions,
): UseAutosaveRecoveryResult {
	const prompt = ref<AutosaveRecoveryPrompt | null>(null);
	const discarding = ref(false);
	let record: AutosaveRecord | null = null;
	let checked = false;
	let actionPending = false;

	watch(
		() => [options.loading.value, options.error.value, options.slideCount(), options.filePath()],
		() => {
			const filePath = options.filePath();
			if (
				!shouldProbeAutosaveRecovery({
					alreadyChecked: checked,
					filePath,
					loading: options.loading.value,
					error: options.error.value ?? null,
					slideCount: options.slideCount(),
					autosaveAllowed: options.autosaveAllowed(),
				})
			) {
				return;
			}
			checked = true;
			void probeAutosaveRecovery(filePath as string, Date.now(), options.fileName()).then(
				(offer) => {
					if (offer) {
						record = offer.record;
						prompt.value = offer.prompt;
					}
					return offer;
				},
			);
		},
		{ immediate: true },
	);

	function restore(): void {
		if (actionPending) {
			return;
		}
		actionPending = true;
		const found = record;
		prompt.value = null;
		record = null;
		if (found) {
			options.onRestore(acceptAutosaveRecovery(found));
			acknowledgeAutosaveRecovery(found);
		}
	}

	async function discard(): Promise<void> {
		if (actionPending) {
			return;
		}
		const found = record;
		if (!found) {
			prompt.value = null;
			return;
		}
		actionPending = true;
		discarding.value = true;
		try {
			await discardAutosaveRecovery(found);
			record = null;
			prompt.value = null;
		} catch {
			// Leave the prompt open so a failed discard can be retried.
		} finally {
			actionPending = false;
			discarding.value = false;
		}
	}

	return { prompt, discarding, restore, discard };
}
