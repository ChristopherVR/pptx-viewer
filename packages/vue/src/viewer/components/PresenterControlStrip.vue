<script setup lang="ts">
/**
 * PresenterControlStrip - PowerPoint's presenter-console control strip.
 *
 * Rendered from the shared {@link PRESENTER_CONSOLE_CONTROLS} inventory rather
 * than hand-written markup: the hand-written version carried English visible
 * text (`Pause`, `All slides`, `Fit`, `laser`), so the console was
 * untranslatable, and it ordered zoom `-` before `+` where React ordered `+`
 * first. Every slot now emits `data-pptx-presenter-control="<id>"` so the
 * framework-neutral e2e specs can address the same strip in all five bindings.
 */
import { PRESENTER_CONSOLE_CLASSES } from 'pptx-viewer-shared';
import type { PresentationPointerTool, PresentationSnapshot } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	presenterBlackoutValue,
	presenterConsoleSlots,
	presenterPointerTool,
} from '../composables/presenter-console';
import type { PresenterConsoleSlot } from '../composables/presenter-console';

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
const classes = PRESENTER_CONSOLE_CLASSES;
const slots = computed(() => presenterConsoleSlots(props.snapshot, props.audienceOpen));

/**
 * Translate a click on a slot into the host-facing intent for its id. The
 * stateful slots (annotation tools, blackout) toggle off when they are already
 * engaged, which is what makes a second press of Pen return to the arrow.
 */
function activate(slot: PresenterConsoleSlot): void {
	const tool = presenterPointerTool(slot.id);
	if (tool !== undefined) {
		emit('tool', slot.active ? 'none' : tool);
		return;
	}
	const blackout = presenterBlackoutValue(slot.id);
	if (blackout !== undefined) {
		emit('blackout', slot.active ? 'none' : blackout);
		return;
	}
	switch (slot.id) {
		case 'timer-toggle':
			emit('timer');
			break;
		case 'timer-reset':
			emit('reset-timer');
			break;
		case 'all-slides':
			emit('slides');
			break;
		case 'zoom-in':
			emit('zoom', 1);
			break;
		case 'zoom-out':
			emit('zoom', -1);
			break;
		case 'zoom-reset':
			emit('reset-zoom');
			break;
		case 'captions':
			emit('subtitles');
			break;
		case 'audience':
			emit('audience');
			break;
		case 'swap-displays':
			emit('swap-displays');
			break;
		case 'end':
			emit('exit');
			break;
		default:
			break;
	}
}
</script>

<template>
	<div class="pptx-vue-presenter-strip" :class="classes.strip" data-pptx-presenter-strip>
		<template v-for="slot in slots" :key="slot.id">
			<span v-if="slot.kind === 'divider'" :class="classes.divider" aria-hidden="true" />
			<span v-else-if="slot.kind === 'spacer'" :class="classes.spacer" />
			<button
				v-else
				type="button"
				class="pptx-vue-presenter-control"
				:class="slot.active ? classes.controlActive : classes.control"
				:data-pptx-presenter-control="slot.id"
				:aria-label="t(slot.labelKey)"
				:title="t(slot.labelKey)"
				:aria-pressed="slot.kind === 'toggle' ? slot.active : undefined"
				@click="activate(slot)"
			>
				<component :is="slot.icon" v-if="slot.icon" class="h-4 w-4" aria-hidden="true" />
				<span v-if="slot.glyph" aria-hidden="true">{{ slot.glyph }}</span>
			</button>
		</template>
	</div>
</template>
