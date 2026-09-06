/**
 * The Transitions ribbon tab's Sound picker: "Other Sound..." opens a native
 * file picker (the chosen file is embedded into the package on save, core's
 * `embedTransitionSound`), one of PowerPoint's 19 built-in stock sounds
 * commits directly, "None" clears any sound the slide carries, and Preview
 * plays the currently-selected stock sound. Extracted from
 * `TransitionsSection.tsx` to keep that file under the repo's 300-LOC limit.
 */
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import {
	applyTransitionSoundFile,
	applyTransitionStockSound,
	clearTransitionSound,
	getEffectSoundAsset,
	readSoundFileAsDataUrl,
	transitionSoundSelectedValue,
	transitionStockSoundId,
	TRANSITION_SOUND_NONE_VALUE,
	TRANSITION_SOUND_OTHER_VALUE,
} from 'pptx-viewer-shared';
import React from 'react';

import { playAnimationSound } from '../../utils/animation-sound';

export interface TransitionSoundPicker {
	soundFileInputRef: React.RefObject<HTMLInputElement | null>;
	stockSoundId: string | undefined;
	handleSoundSelectChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
	handleSoundFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	handleSoundPreview: () => void;
}

export function useTransitionSoundPicker(
	activeSlide: PptxSlide | undefined,
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void,
): TransitionSoundPicker {
	const soundFileInputRef = React.useRef<HTMLInputElement>(null);

	const handleSoundFilePicked = React.useCallback(
		(file: File) => {
			void readSoundFileAsDataUrl(file).then((dataUrl) => {
				if (dataUrl) {
					onTransitionChange(applyTransitionSoundFile({ name: file.name, dataUrl }));
				}
				return undefined;
			});
		},
		[onTransitionChange],
	);

	const handleSoundSelectChange = React.useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>) => {
			const value = event.target.value;
			if (value === TRANSITION_SOUND_OTHER_VALUE) {
				soundFileInputRef.current?.click();
				// The file input's own change (or a cancelled dialog) decides what
				// happens next; put the select back to what the slide actually has.
				event.target.value = transitionSoundSelectedValue(activeSlide?.transition);
				return;
			}
			if (value === TRANSITION_SOUND_NONE_VALUE) {
				onTransitionChange(clearTransitionSound());
				return;
			}
			// One of PowerPoint's 19 built-in stock sounds (catalogue id).
			const patch = applyTransitionStockSound(value);
			if (patch) {
				onTransitionChange(patch);
			}
		},
		[activeSlide, onTransitionChange],
	);

	const handleSoundFileChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (file) {
				handleSoundFilePicked(file);
			}
			event.target.value = '';
		},
		[handleSoundFilePicked],
	);

	const stockSoundId = transitionStockSoundId(activeSlide?.transition);
	const handleSoundPreview = React.useCallback(() => {
		if (!stockSoundId) {
			return;
		}
		const asset = getEffectSoundAsset(stockSoundId);
		if (asset) {
			playAnimationSound(asset.dataUrl);
		}
	}, [stockSoundId]);

	return {
		soundFileInputRef,
		stockSoundId,
		handleSoundSelectChange,
		handleSoundFileChange,
		handleSoundPreview,
	};
}
