import type { PptxAnimationPreset } from 'pptx-viewer-core';
import type { AnimationGroup } from 'pptx-viewer-shared';
import {
	EMPHASIS_PRESET_VALUES,
	ENTRANCE_PRESET_VALUES,
	EXIT_PRESET_VALUES,
} from 'pptx-viewer-shared';

/** One preset-gallery category: label key, group bucket, and its preset catalogue. */
export interface AnimationCategory {
	group: AnimationGroup;
	labelKey: string;
	presets: readonly PptxAnimationPreset[];
}

export const ANIMATION_CATEGORIES: readonly AnimationCategory[] = [
	{ group: 'entrance', labelKey: 'pptx.animation.entrance', presets: ENTRANCE_PRESET_VALUES },
	{ group: 'emphasis', labelKey: 'pptx.animation.emphasis', presets: EMPHASIS_PRESET_VALUES },
	{ group: 'exit', labelKey: 'pptx.animation.exit', presets: EXIT_PRESET_VALUES },
];
