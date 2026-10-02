<script setup lang="ts">
import type {
	PresentationBlackout,
	PresentToolbarRequestEvent,
	PresentToolbarViewState,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { PresentationTool } from '../composables/usePresentationAnnotations';

/**
 * PresentationToolbar - floating control bar shown during presentation mode.
 *
 * Contains prev/next navigation, a slide counter, an elapsed timer, the
 * annotation-tool toggles (laser / pen / highlighter / eraser) with colour
 * dropdowns, a clear-all button, an optional presenter-view toggle, and an
 * end-presentation button. A thin adapter around the shared
 * `pptx-ui-present-toolbar`: the element renders the shared control inventory, the
 * palettes and the elapsed readout; this maps props onto its state and re-emits its
 * typed intents. Vue port of the React `PresentationToolbar`.
 *
 * The auto-hide-on-idle behaviour lives in the host (it owns the container
 * geometry); this component is the always-mounted bar.
 */
const props = withDefaults(
	defineProps<{
		presentationTool: PresentationTool;
		penColor: string;
		highlighterColor: string;
		hasAnnotations: boolean;
		currentSlideIndex: number;
		totalSlides: number;
		/** Timestamp (ms) the presentation started, or `null`. */
		presentationStartTime: number | null;
		/** Whether presenter view is currently active. */
		presenterMode?: boolean;
		/** Whether to show the presenter-view toggle button. */
		showPresenterToggle?: boolean;
		/** Presenter-snapshot blackout state, for the Blackboard toggle. */
		blackout?: PresentationBlackout;
	}>(),
	{ presenterMode: false, showPresenterToggle: false, blackout: 'none' },
);

const emit = defineEmits<{
	(e: 'set-tool', tool: PresentationTool): void;
	(e: 'set-pen-color' | 'set-highlighter-color', color: string): void;
	(
		e: 'clear-annotations' | 'end-presentation' | 'toggle-presenter-view' | 'toggle-blackboard',
	): void;
	(e: 'move', direction: 1 | -1): void;
}>();

const { t } = useI18n();

const state = computed<PresentToolbarViewState>(() => ({
	current: props.currentSlideIndex,
	total: props.totalSlides,
	tool: props.presentationTool,
	penColor: props.penColor,
	highlighterColor: props.highlighterColor,
	hasAnnotations: props.hasAnnotations,
	blackout: props.blackout,
	presenterViewVisible: props.showPresenterToggle,
	presenterViewActive: props.presenterMode,
	startTime: props.presentationStartTime,
	translate: t,
}));

function request(event: Event): void {
	const intent = (event as PresentToolbarRequestEvent).detail;
	switch (intent.id) {
		case 'move':
			emit('move', intent.direction);
			break;
		case 'tool':
			emit('set-tool', intent.tool);
			break;
		case 'color':
			emit(intent.tool === 'pen' ? 'set-pen-color' : 'set-highlighter-color', intent.color);
			if (props.presentationTool !== intent.tool) {
				emit('set-tool', intent.tool);
			}
			break;
		case 'blackboard':
			emit('toggle-blackboard');
			break;
		case 'clear':
			emit('clear-annotations');
			break;
		case 'presenterView':
			emit('toggle-presenter-view');
			break;
		case 'end':
			emit('end-presentation');
	}
}
</script>

<template>
	<pptx-ui-present-toolbar :state.prop="state" @present-toolbar-request="request" />
</template>
