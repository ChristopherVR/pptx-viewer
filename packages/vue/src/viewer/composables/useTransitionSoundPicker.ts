/**
 * The Transitions ribbon tab's Sound picker: "Other Sound..." opens a native
 * file picker (the chosen file is embedded into the package on save, core's
 * `embedTransitionSound`), one of PowerPoint's 19 built-in stock sounds
 * commits directly, "None" clears any sound the slide carries, and Preview
 * plays the currently-selected stock sound. Extracted from
 * `TransitionsSection.vue` to keep that SFC under the repo's 300-LOC limit;
 * the React binding has the same composable under the same name.
 */
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import {
	applyTransitionSoundFile,
	applyTransitionStockSound,
	clearTransitionSound,
	getEffectSoundAsset,
	readSoundFileAsDataUrl,
	TRANSITION_SOUND_NONE_VALUE,
	TRANSITION_SOUND_OTHER_VALUE,
	transitionSoundOptions,
	transitionSoundSelectedValue,
	transitionStockSoundId,
} from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';

import { playAnimationSound } from './animation-sound';

export interface TransitionSoundPicker {
	/** The hidden `<input type="file">` the "Other Sound..." entry clicks. */
	soundFileInput: Ref<HTMLInputElement | null>;
	soundSelectedValue: ComputedRef<string>;
	soundOptions: ComputedRef<ReturnType<typeof transitionSoundOptions>>;
	stockSoundId: ComputedRef<string | undefined>;
	onSoundSelectChange: (event: Event) => void;
	onSoundPreview: () => void;
	onSoundFileChange: (event: Event) => void;
}

export function useTransitionSoundPicker(
	activeSlide: () => PptxSlide | undefined,
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void,
): TransitionSoundPicker {
	const soundFileInput = ref<HTMLInputElement | null>(null);
	const soundSelectedValue = computed(() =>
		transitionSoundSelectedValue(activeSlide()?.transition),
	);
	const soundOptions = computed(() => transitionSoundOptions(activeSlide()?.transition));
	const stockSoundId = computed(() => transitionStockSoundId(activeSlide()?.transition));

	function onSoundSelectChange(event: Event): void {
		const select = event.target as HTMLSelectElement;
		if (select.value === TRANSITION_SOUND_OTHER_VALUE) {
			soundFileInput.value?.click();
			// The file input's own change (or a cancelled dialog) decides what
			// happens next; put the select back to what the slide actually has.
			select.value = soundSelectedValue.value;
			return;
		}
		if (select.value === TRANSITION_SOUND_NONE_VALUE) {
			onTransitionChange(clearTransitionSound());
			return;
		}
		// One of PowerPoint's 19 built-in stock sounds (catalogue id).
		const patch = applyTransitionStockSound(select.value);
		if (patch) {
			onTransitionChange(patch);
		}
	}

	function onSoundPreview(): void {
		const id = stockSoundId.value;
		if (!id) {
			return;
		}
		const asset = getEffectSoundAsset(id);
		if (asset) {
			playAnimationSound(asset.dataUrl);
		}
	}

	function onSoundFileChange(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) {
			return;
		}
		void readSoundFileAsDataUrl(file).then((dataUrl) => {
			if (dataUrl) {
				onTransitionChange(applyTransitionSoundFile({ name: file.name, dataUrl }));
			}
			return undefined;
		});
	}

	return {
		soundFileInput,
		soundSelectedValue,
		soundOptions,
		stockSoundId,
		onSoundSelectChange,
		onSoundPreview,
		onSoundFileChange,
	};
}
