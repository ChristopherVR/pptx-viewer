<script setup lang="ts">
import {
	createViewerOptionsStore,
	subtitleSettingsFromOptions,
	subtitleSettingsLabels,
	updateSubtitleSettings,
} from 'pptx-viewer-shared';
import type { SubtitleSettingsChangeEvent } from 'pptx-viewer-shared';
import { inject, onScopeDispose, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { ViewerOptionsStoreKey } from '../../composables/useViewerOptionsStore';

const { t } = useI18n();
const store = inject(ViewerOptionsStoreKey, null) ?? createViewerOptionsStore({ persist: false });
const options = shallowRef(store.getOptions());
onScopeDispose(
	store.subscribe((value) => {
		options.value = value;
	}),
);
function commit(event: Event): void {
	updateSubtitleSettings(store, (event as SubtitleSettingsChangeEvent).detail);
}
</script>

<template>
	<pptx-ui-subtitle-settings
		data-ribbon-control="slideShow.captions.subtitleSettings"
		:settings.prop="subtitleSettingsFromOptions(options)"
		:labels.prop="subtitleSettingsLabels(t)"
		:languageDisabled.prop="store.isLocked('accessibility', 'subtitleLanguage')"
		@subtitle-settings-change="commit"
	></pptx-ui-subtitle-settings>
</template>
