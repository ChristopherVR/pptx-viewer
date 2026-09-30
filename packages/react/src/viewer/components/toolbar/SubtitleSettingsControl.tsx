import {
	createViewerOptionsStore,
	subtitleSettingsFromOptions,
	subtitleSettingsLabels,
	updateSubtitleSettings,
} from 'pptx-viewer-shared';
import type {
	PptxUiSubtitleSettingsElement,
	SubtitleSettingsChangeEvent,
} from 'pptx-viewer-shared';
import React, { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { ViewerOptionsStoreContext } from '../viewer-options-context';

/** Native lifecycle and preference ownership only; shared owns trigger and dialog. */
export function SubtitleSettingsControl(): React.ReactElement {
	const { t } = useTranslation();
	const supplied = useContext(ViewerOptionsStoreContext);
	const fallback = useRef<ReturnType<typeof createViewerOptionsStore> | null>(null);
	if (!supplied) {
		fallback.current ??= createViewerOptionsStore({ persist: false });
	}
	const store = supplied ?? fallback.current!;
	const options = useSyncExternalStore(
		(callback) => store.subscribe(callback),
		() => store.getOptions(),
		() => store.getOptions(),
	);
	const ref = useRef<PptxUiSubtitleSettingsElement>(null);
	useEffect(() => {
		const element = ref.current!;
		element.settings = subtitleSettingsFromOptions(options);
		element.labels = subtitleSettingsLabels((key) => t(key));
		element.languageDisabled = store.isLocked('accessibility', 'subtitleLanguage');
	}, [options, store, t]);
	useEffect(() => {
		const element = ref.current!;
		const commit = (event: Event) =>
			updateSubtitleSettings(store, (event as SubtitleSettingsChangeEvent).detail);
		element.addEventListener('subtitle-settings-change', commit);
		return () => element.removeEventListener('subtitle-settings-change', commit);
	}, [store]);
	return (
		<pptx-ui-subtitle-settings
			ref={ref}
			data-ribbon-control='slideShow.captions.subtitleSettings'
		/>
	);
}
