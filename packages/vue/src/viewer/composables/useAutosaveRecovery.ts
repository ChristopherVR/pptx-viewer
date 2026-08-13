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
	restore: () => void;
	discard: () => void;
}

export function useAutosaveRecovery(
	options: UseAutosaveRecoveryOptions,
): UseAutosaveRecoveryResult {
	const prompt = ref<AutosaveRecoveryPrompt | null>(null);
	let record: AutosaveRecord | null = null;
	let checked = false;

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
			void probeAutosaveRecovery(filePath as string).then((offer) => {
				if (offer) {
					record = offer.record;
					prompt.value = offer.prompt;
				}
				return offer;
			});
		},
		{ immediate: true },
	);

	function restore(): void {
		const found = record;
		prompt.value = null;
		record = null;
		if (found) {
			options.onRestore(acceptAutosaveRecovery(found));
		}
	}

	function discard(): void {
		const found = record;
		prompt.value = null;
		record = null;
		if (found) {
			void discardAutosaveRecovery(found);
		}
	}

	return { prompt, restore, discard };
}
