import type { PptxPresentationProperties } from 'pptx-viewer-core';
import { ref, watch } from 'vue';
import type { Ref } from 'vue';

export interface UseSlideShowSettingsInput {
	presentationProperties: Ref<PptxPresentationProperties>;
}

export interface UseSlideShowSettingsResult {
	showSetUpSlideShow: Ref<boolean>;
	showSubtitles: Ref<boolean>;
	onSaveSlideShowSettings: (next: PptxPresentationProperties) => void;
	onPresentationPropertiesUpdate: (patch: Partial<PptxPresentationProperties>) => void;
	onToggleSubtitles: () => void;
}

/**
 * useSlideShowSettings: Slide Show ▸ Set Up Slide Show dialog plus the
 * Subtitles ribbon toggle, both of which read/write the shared
 * `presentationProperties` draft. Extracted verbatim from
 * `PowerPointViewer.vue`.
 */
export function useSlideShowSettings(input: UseSlideShowSettingsInput): UseSlideShowSettingsResult {
	const { presentationProperties } = input;

	// Edits a draft copy of the presentation-level properties; on save we commit
	// the new properties. `saveAs` forwards `presentationProperties` to
	// `handler.save`, so the change round-trips into the saved `.pptx` (same
	// persist-via-refs pattern as document properties).
	const showSetUpSlideShow = ref(false);
	const showSubtitles = ref(false);
	watch(
		() => presentationProperties.value.showSubtitles,
		(value) => {
			showSubtitles.value = Boolean(value);
		},
		{ immediate: true },
	);

	function onSaveSlideShowSettings(next: PptxPresentationProperties): void {
		presentationProperties.value = next;
		showSubtitles.value = Boolean(next.showSubtitles);
	}
	/** Merge a partial presentation-properties patch (from the slide inspector). */
	function onPresentationPropertiesUpdate(patch: Partial<PptxPresentationProperties>): void {
		presentationProperties.value = { ...presentationProperties.value, ...patch };
	}
	function onToggleSubtitles(): void {
		showSubtitles.value = !showSubtitles.value;
		presentationProperties.value = {
			...presentationProperties.value,
			showSubtitles: showSubtitles.value,
		};
	}

	return {
		showSetUpSlideShow,
		showSubtitles,
		onSaveSlideShowSettings,
		onPresentationPropertiesUpdate,
		onToggleSubtitles,
	};
}
