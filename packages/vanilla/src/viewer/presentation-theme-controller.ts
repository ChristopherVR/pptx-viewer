import {
	buildSaveSlides,
	GALLERY_THEME_PRESETS,
	partitionTemplateElements,
} from 'pptx-viewer-shared';

import type { EditorController } from './editor';
import type { LoadingController } from './loading-controller';
import type { Store, ViewerState } from './state';

/**
 * Design > Browse Themes: apply a shared gallery preset (`GALLERY_THEME_PRESETS`,
 * the set every binding's Browse Themes offers) to both the live archive and
 * the rendered slide data, as one undoable step.
 */
export async function applyPresentationThemePreset(options: {
	presetId: string;
	loading: LoadingController;
	store: Store<ViewerState>;
	editor: EditorController;
}): Promise<boolean> {
	const preset = GALLERY_THEME_PRESETS.find(({ id }) => id === options.presetId);
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
		fontScheme: preset.fontScheme,
		themeName: preset.name,
	});
	return true;
}
