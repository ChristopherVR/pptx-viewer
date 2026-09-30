import {
	createViewerOptionsStore,
	subtitleSettingsFromOptions,
	subtitleSettingsLabels,
	updateSubtitleSettings,
} from 'pptx-viewer-shared';
import type { SubtitleSettingsChangeEvent, ViewerOptionsStore } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';

export function createSubtitleSettingsControl(
	doc: Document,
	t: Translator,
	provided?: ViewerOptionsStore | (() => ViewerOptionsStore | undefined),
): HTMLElement {
	const fallback = createViewerOptionsStore({ persist: false });
	// Initial chrome is mounted before the viewer constructs its options controller.
	const getStore = () => (typeof provided === 'function' ? provided() : provided) ?? fallback;
	const element = doc.createElement('pptx-ui-subtitle-settings');
	element.setAttribute('data-ribbon-control', 'slideShow.captions.subtitleSettings');
	const sync = (): void => {
		const store = getStore();
		element.settings = subtitleSettingsFromOptions(store.getOptions());
		element.labels = subtitleSettingsLabels(t);
		element.languageDisabled = store.isLocked('accessibility', 'subtitleLanguage');
	};
	// Read live preferences before the shared trigger initializes its dialog draft.
	element.addEventListener('command-request', sync, true);
	element.addEventListener('subtitle-settings-change', (event) => {
		updateSubtitleSettings(getStore(), (event as SubtitleSettingsChangeEvent).detail);
		sync();
	});
	sync();
	return element;
}
