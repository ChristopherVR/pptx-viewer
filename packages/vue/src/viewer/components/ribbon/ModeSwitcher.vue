<script setup lang="ts">
/**
 * ModeSwitcher: the Vue 3 port of React's `ModeSwitcher` from
 * `toolbar/ModeSwitcher.tsx`. In master mode it renders the "Master View" badge
 * + Close button; otherwise it delegates to `PresentDropdown` (view-mode buttons
 * live in the status bar). A faithful, mechanical port for visual + behavioral
 * parity: class strings are copied verbatim, callbacks arrive as function props.
 */
import { useI18n } from 'vue-i18n';

import PresentDropdown from './PresentDropdown.vue';
import type { ViewerMode } from './ribbon-types';

interface Props {
	mode: ViewerMode;
	onSetMode: (mode: ViewerMode) => void;
	onCloseMasterView: () => void;
	onEnterPresenterView?: () => void;
	onEnterRehearsalMode?: () => void;
	onOpenSetUpSlideShow?: () => void;
	onOpenBroadcastDialog?: () => void;
	onToggleSubtitles?: () => void;
	showSubtitles?: boolean;
}

const props = defineProps<Props>();
const { t } = useI18n();
</script>

<template>
	<div v-if="props.mode === 'master'" class="inline-flex items-center gap-1.5">
		<span
			class="inline-flex items-center px-2 py-0.5 rounded-sm bg-amber-600/90 text-[10px] text-amber-50"
		>
			{{ t('pptx.mode.masterView') }}
		</span>
		<button
			type="button"
			class="px-2 py-0.5 rounded-sm hover:bg-accent text-[10px] text-foreground transition-colors"
			:title="t('pptx.mode.closeMasterViewTooltip')"
			@click="props.onCloseMasterView()"
		>
			{{ t('pptx.slideSorter.close') }}
		</button>
	</div>
	<!-- Present dropdown only; view mode buttons moved to status bar -->
	<PresentDropdown
		v-else
		:is-active="props.mode === 'present'"
		:on-present="() => props.onSetMode('present')"
		:on-presenter-view="props.onEnterPresenterView"
		:on-rehearse="props.onEnterRehearsalMode"
		:on-set-up-slide-show="props.onOpenSetUpSlideShow"
		:on-broadcast="props.onOpenBroadcastDialog"
		:on-toggle-subtitles="props.onToggleSubtitles"
		:show-subtitles="props.showSubtitles"
	/>
</template>
