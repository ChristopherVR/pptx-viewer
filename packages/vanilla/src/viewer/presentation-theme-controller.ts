import { THEME_PRESETS } from 'pptx-viewer-core';
import { buildSaveSlides, partitionTemplateElements } from 'pptx-viewer-shared';

import type { EditorController } from './editor';
import type { LoadingController } from './loading-controller';
import type { Store, ViewerState } from './state';

/** Apply a core theme preset to both the live archive and rendered slide data. */
export async function applyPresentationThemePreset(options: {
	presetId: string;
	loading: LoadingController;
	store: Store<ViewerState>;
	editor: EditorController;
}): Promise<boolean> {
	const preset = THEME_PRESETS.find(({ id }) => id === options.presetId);
	const handler = options.loading.getHandler();
	if (!preset || !handler) {
		return false;
	}
	const state = options.store.get();
	const updated = await handler.switchThemePreset(
		{
			slides: buildSaveSlides(state.slides, state.templateElementsBySlideId),
			width: state.canvasSize.width,
			height: state.canvasSize.height,
			themeColorMap: state.colorScheme ? { ...state.colorScheme } : undefined,
			theme: { colorScheme: state.colorScheme },
		},
		preset,
	);
	const partition = partitionTemplateElements(updated.slides);
	options.editor.commitSlides(partition.slides, state.currentSlide);
	options.store.set({
		templateElementsBySlideId: partition.templateElementsBySlideId,
		colorScheme: preset.colorScheme,
	});
	return true;
}
