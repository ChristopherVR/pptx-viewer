<script setup lang="ts">
/**
 * CompatibilityToasts: the bottom-right load-diagnostic stack for
 * `PptxCompatibilityWarning`s (unmodelled markup, an external image
 * reference, a chart workbook writeback that failed, and so on). Every
 * warning already flows through the shared `compatibilityWarningToasts`
 * decision function (`useCompatibilityToasts`); this component is a thin
 * adapter around the shared `pptx-ui-compat-toasts` element, which renders the
 * list, positions itself from `compatToastStackStyle` and emits typed intents.
 *
 * Unlike a transient toast, these do not auto-hide: they are diagnostics
 * about the LOADED document, so they persist until the user dismisses them
 * (or the next load resets the stack).
 *
 * `rightInset` (default 0) is the width of whatever right-docked panel
 * (format/inspector or AI chat) is currently open: the viewer ROOT this
 * stack is anchored to spans the FULL chrome width including that panel, so
 * without it the stack's `right: 12px` lands under the panel's own content
 * instead of clear of it (it rendered on top of, and visually inside, the
 * Properties panel).
 *
 * `bottomInset` (default 0) is the live height of the docked "Speaker notes"
 * strip: it sits between the canvas and the status bar in the same containing
 * block, so without it the stack only clears the status bar and overlaps the
 * strip.
 */
import type { CompatibilityWarningToast, CompatToastsRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
	defineProps<{
		toasts: CompatibilityWarningToast[];
		overflowCount: number;
		rightInset?: number;
		bottomInset?: number;
	}>(),
	{ rightInset: 0, bottomInset: 0 },
);

const emit = defineEmits<{
	dismiss: [id: string];
	'dismiss-all': [];
}>();

const { t } = useI18n();

const state = computed(() => ({
	toasts: props.toasts,
	overflowCount: props.overflowCount,
	rightInset: props.rightInset,
	bottomInset: props.bottomInset,
	translate: t,
}));

function request(event: Event): void {
	const intent = (event as CompatToastsRequestEvent).detail;
	if (intent.id === 'dismissAll') {
		emit('dismiss-all');
	} else {
		emit('dismiss', intent.toastId);
	}
}
</script>

<template>
	<pptx-ui-compat-toasts
		v-if="props.toasts.length > 0"
		:state.prop="state"
		@compat-toasts-request="request"
	/>
</template>
