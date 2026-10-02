<script setup lang="ts">
/**
 * PresenterControlStrip - PowerPoint's presenter-console control strip.
 *
 * A thin adapter around the shared `pptx-ui-presenter-console`, which renders the
 * shared {@link PRESENTER_CONSOLE_CONTROLS} inventory with its accessible names,
 * icons and pressed state under `data-pptx-presenter-control="<id>"`. The on and
 * disabled rule (`presenterConsoleViewState`) and the meaning of each activation
 * (`presenterConsoleAction`) are shared too; this maps the resulting action to the
 * emits the console host already handles.
 */
import { presenterConsoleAction, presenterConsoleViewState } from 'pptx-viewer-shared';
import type {
	PresentationPointerTool,
	PresentationSnapshot,
	PresenterConsoleRequestEvent,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ snapshot: PresentationSnapshot; audienceOpen: boolean }>();
const emit = defineEmits<{
	(
		e:
			| 'timer'
			| 'reset-timer'
			| 'slides'
			| 'reset-zoom'
			| 'audience'
			| 'subtitles'
			| 'swap-displays'
			| 'exit',
	): void;
	(e: 'zoom', direction: -1 | 1): void;
	(e: 'blackout', value: PresentationSnapshot['blackout']): void;
	(e: 'tool', tool: PresentationPointerTool): void;
}>();

const { t } = useI18n();
const state = computed(() => ({
	...presenterConsoleViewState(props.snapshot, props.audienceOpen),
	translate: t,
}));

/** The strip's own event name for each argument-less action. */
const PLAIN_EVENT = {
	'timer-toggle': 'timer',
	'timer-reset': 'reset-timer',
	'all-slides': 'slides',
	'zoom-reset': 'reset-zoom',
	captions: 'subtitles',
	audience: 'audience',
	'swap-displays': 'swap-displays',
	end: 'exit',
} as const;

function request(event: Event): void {
	const action = presenterConsoleAction(
		(event as PresenterConsoleRequestEvent).detail.id,
		props.snapshot,
	);
	if (!action) {
		return;
	}
	switch (action.kind) {
		case 'pointer':
			emit('tool', action.tool);
			break;
		case 'blackout':
			emit('blackout', action.value);
			break;
		case 'zoom':
			emit('zoom', action.direction);
			break;
		default:
			emit(PLAIN_EVENT[action.kind]);
	}
}
</script>

<template>
	<pptx-ui-presenter-console :state.prop="state" @presenter-console-request="request" />
</template>
