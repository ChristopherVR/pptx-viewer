<script setup lang="ts">
/**
 * EditingSection: Find, Replace and Select for the Home ribbon tab. All three
 * are the shared `pptx-ui-ribbon-home-editing` element (Select is its own
 * popover menu); this adapter opens the find panel and runs Select All.
 */
import { editingHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { SEP } from './ribbon-constants';

interface Props {
	onToggleFindReplace: () => void;
	onSelectAll?: () => void;
}

const props = defineProps<Props>();
const { t, locale } = useI18n();

const editingState = computed(() => ({
	controls: editingHomeControls(),
	// The locale is read so a language switch re-translates the shared labels.
	locale: locale.value,
	translate: homeSnapshotTranslator(['editing'], t),
}));

function request(event: RibbonHomeRequestEvent): void {
	if (event.detail.id === 'home.editing.select') {
		// The shared row keeps the canvas focus (mousedown is prevented), so the
		// selection the command makes is not wiped by the outside-click handler.
		props.onSelectAll?.();
	} else {
		props.onToggleFindReplace();
	}
}
</script>

<template>
	<div :class="SEP" />

	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.editing">
		<div class="flex items-center gap-1" data-pptx-chrome="editing-controls">
			<pptx-ui-ribbon-home-editing :state.prop="editingState" @home-request="request" />
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.shortcuts.group.editing')
		}}</span>
	</div>
</template>
