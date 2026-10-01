<script setup lang="ts">
/**
 * StatusBar - thin adapter around the shared `pptx-ui-status-bar` element.
 *
 * The slide counter, save indicator, notes toggle, view-mode buttons and zoom
 * cluster live in the shared view. This component maps viewer state onto the
 * element's controlled state and re-emits its typed intents.
 */
import { resolveStatusBarSave, statusBarViewMode } from 'pptx-viewer-shared';
import type { StatusBarRequestEvent, ToolbarActionId } from 'pptx-viewer-shared';
import { computed, useSlots } from 'vue';
import { useI18n } from 'vue-i18n';

import type { AutosaveStatus } from '../composables/useAutosave';
import { useToolbarVisibility } from '../composables/useToolbarVisibility';

const { t } = useI18n();

const props = defineProps<{
	slideCount: number;
	activeSlideIndex: number;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	/** Epoch ms of the last successful autosave, for the "Saved <time>" label. */
	lastSavedAt?: number | null;
	/** Current zoom scale (1 = 100%). */
	scale?: number;
	/** Whether the notes panel is expanded. */
	isNotesExpanded?: boolean;
	/** Current viewer mode. */
	mode?: string;
	/** Whether the Notes toggle is shown (host has a notes panel). */
	showNotes?: boolean;
	/** Toolbar buttons the host has asked to hide (zoom, notes, fullscreen). */
	hiddenActions?: ToolbarActionId[];
}>();

const slots = useSlots();
const { isHidden } = useToolbarVisibility(() => props.hiddenActions);

const emit = defineEmits<{
	'zoom-in': [];
	'zoom-out': [];
	'zoom-to-fit': [];
	'toggle-notes': [];
	'set-mode': [mode: 'edit' | 'present'];
	'toggle-slide-sorter': [];
}>();

const state = computed(() => {
	const save = resolveStatusBarSave(
		t,
		props.autosaveStatus
			? { state: props.autosaveStatus, timestamp: props.lastSavedAt ?? undefined }
			: undefined,
		props.isDirty,
	);
	return {
		slideCount: props.slideCount,
		activeSlideIndex: props.activeSlideIndex,
		saveText: save.text,
		saveKind: save.kind,
		zoomPercent:
			props.scale !== undefined && !isHidden('zoom') ? (props.scale ?? 1) * 100 : undefined,
		showNotes: props.showNotes === true && !isHidden('notes'),
		notesExpanded: props.isNotesExpanded === true,
		showSlideShow: !isHidden('fullscreen'),
		viewMode: statusBarViewMode(props.mode),
		translate: t,
	};
});

function request(event: Event): void {
	switch ((event as StatusBarRequestEvent).detail.id) {
		case 'notes':
			emit('toggle-notes');
			break;
		case 'normal':
			emit('set-mode', 'edit');
			break;
		case 'sorter':
			emit('toggle-slide-sorter');
			break;
		case 'slideShow':
			emit('set-mode', 'present');
			break;
		case 'zoomOut':
			emit('zoom-out');
			break;
		case 'zoomFit':
			emit('zoom-to-fit');
			break;
		case 'zoomIn':
			emit('zoom-in');
	}
}
</script>

<template>
	<pptx-ui-status-bar :state.prop="state" @status-request="request">
		<div v-if="slots.collaboration" slot="collaboration" style="display: contents">
			<slot name="collaboration" />
		</div>
	</pptx-ui-status-bar>
</template>
