<script setup lang="ts">
/**
 * MobileToolbar - Vue port of React's
 * `components/mobile/MobileToolbar.tsx`.
 *
 * Compact top row that replaces the desktop ribbon on a phone:
 *   menu - undo - redo - [spacer] - save - present - share
 *
 * All section-specific functionality (Home / Insert / Design / ...) lives in
 * the MobileMenuSheet opened by the hamburger button; the bottom bar carries the
 * five sheet destinations (Slides / Insert / Format / Comments / Notes). The menu
 * button + sheet are gated on edit mode, while Save + Present stay reachable even
 * in view-only mode (mirrors React).
 *
 * A thin adapter around the shared `pptx-ui-mobile-toolbar`, which owns the markup
 * and gating of the row; this maps the ribbon props onto its state and routes its
 * `mobile-toolbar-request` intents to the handlers.
 *
 * Conventions vs. React:
 *  - the aggregate `ToolbarProps` becomes our `RibbonProps` bundle (the same
 *    one the host assembles for the desktop ribbon),
 *  - `react-icons/lu` glyphs map to `lucide-vue-next`,
 *  - the section sheet's open state is owned here (local `ref`), exactly like
 *    React's `useState`.
 */
import { isFeatureEnabled } from 'pptx-viewer-shared';
import type { MobileToolbarId, MobileToolbarRequestEvent } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useToolbarVisibility } from '../composables/useToolbarVisibility';
import { useResolvedCustomization } from '../composables/useViewerCustomization';
import MobileMenuSheet from './MobileMenuSheet.vue';
import type { RibbonProps } from './ribbon/ribbon-types';

interface Props extends RibbonProps {}

const props = defineProps<Props>();

const { t } = useI18n();
const { isHidden } = useToolbarVisibility(() => props.hiddenActions);

const menuOpen = ref(false);
const customization = useResolvedCustomization();
const presentModeEnabled = computed(() => isFeatureEnabled(customization.value, 'presentMode'));

const state = computed(() => {
	const hidden: MobileToolbarId[] = [];
	if (isHidden('undo')) {
		hidden.push('undo');
	}
	if (isHidden('redo')) {
		hidden.push('redo');
	}
	if (!presentModeEnabled.value) {
		hidden.push('present');
	}
	if (isHidden('share')) {
		hidden.push('share');
	}
	return {
		// Edit + master modes expose the editing controls (mirrors React's showEdit).
		editable: props.mode === 'edit' || props.mode === 'master',
		canUndo: props.canUndo,
		canRedo: props.canRedo,
		aiVisible: props.aiEnabled === true,
		aiActive: props.isAiPanelOpen === true,
		menuOpen: menuOpen.value,
		hidden,
		translate: t,
	};
});

function request(event: Event): void {
	switch ((event as MobileToolbarRequestEvent).detail.id) {
		case 'menu':
			menuOpen.value = true;
			break;
		case 'undo':
			props.onUndo();
			break;
		case 'redo':
			props.onRedo();
			break;
		case 'ai':
			props.onToggleAiPanel?.();
			break;
		case 'save':
			props.onSaveAsPptx();
			break;
		case 'present':
			props.onSetMode('present');
			break;
		case 'share':
			props.onOpenShareDialog?.();
	}
}
</script>

<template>
	<div class="relative z-20">
		<pptx-ui-mobile-toolbar :state.prop="state" @mobile-toolbar-request="request" />
		<!-- Section sheet -->
		<MobileMenuSheet v-bind="props" :open="menuOpen" @close="menuOpen = false" />
	</div>
</template>
