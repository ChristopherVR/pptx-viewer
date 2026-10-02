<script setup lang="ts">
/**
 * MobileBottomBar - the Vue port of React's mobile bottom navigation
 * (`packages/react/src/viewer/components/mobile/MobileBottomBar.tsx`).
 *
 * Five labelled destination tabs - Slides / Insert / Format / Comments / Notes -
 * each opening a bottom sheet (or, for Insert, quick-inserting a text box),
 * matching the navigation pattern of Office Mobile and Google Slides. The active
 * tab is tinted and carries a top pill indicator.
 *
 * Slide navigation is a horizontal swipe and zoom is a pinch (both handled on the
 * canvas), so this bar carries no prev/next or zoom controls; Present, Save and
 * the section menu live in the top `MobileToolbar`. That division mirrors React,
 * whose mobile StatusBar is hidden and whose bottom bar is purely these five
 * targets.
 *
 * A thin adapter around the shared `pptx-ui-mobile-bar`, which owns the markup, the
 * no-slides gating, the pressed state and the comment badge. Conventions vs. React:
 * function-prop callbacks become emits, and the host is fixed to the bottom edge.
 */
import type { MobileBarIntent, MobileBarRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { MobileActiveSheet } from '../composables/useMobileChrome';

const { t } = useI18n();

const props = withDefaults(
	defineProps<{
		/** Total number of slides in the presentation; every tab disables at 0. */
		slideCount?: number;
		/** The currently-open sheet, so its tab renders active. */
		activeSheet?: MobileActiveSheet;
		/** Number of comments on the active slide (renders a badge, capped at 99+). */
		commentCount?: number;
		/**
		 * CSS pixels the on-screen keyboard covers. When > 0 the fixed bar lifts by
		 * this amount so it stays above the keyboard instead of under it.
		 */
		keyboardInset?: number;
	}>(),
	{ slideCount: 0 },
);

const emit = defineEmits<{
	slides: [];
	insert: [];
	format: [];
	comments: [];
	notes: [];
}>();

/** The shared vocabulary calls the Format tab `inspector`. */
const EVENT_BY_ID: Record<
	MobileBarIntent['id'],
	'slides' | 'insert' | 'format' | 'comments' | 'notes'
> = {
	slides: 'slides',
	insert: 'insert',
	inspector: 'format',
	comments: 'comments',
	notes: 'notes',
};

const state = computed(() => ({
	slideCount: props.slideCount ?? 0,
	// The Vue sheet kinds use `format` where the shared bar says `inspector`.
	activeSheet:
		props.activeSheet === 'format' ? ('inspector' as const) : (props.activeSheet ?? null),
	commentCount: props.commentCount,
	translate: t,
}));

function request(event: Event): void {
	// Vue's typed `emit` is an overload set that rejects a union argument, so
	// dispatch each event name as a literal.
	switch (EVENT_BY_ID[(event as MobileBarRequestEvent).detail.id]) {
		case 'slides':
			emit('slides');
			break;
		case 'insert':
			emit('insert');
			break;
		case 'format':
			emit('format');
			break;
		case 'comments':
			emit('comments');
			break;
		case 'notes':
			emit('notes');
			break;
	}
}

/** Translate the fixed bar up above the on-screen keyboard, if one is open. */
const barStyle = computed(() => {
	const inset = props.keyboardInset ?? 0;
	if (inset <= 0) {
		return undefined;
	}
	return {
		transform: `translateY(-${inset}px)`,
		transition: 'transform 150ms ease-out',
		willChange: 'transform',
	};
});
</script>

<template>
	<pptx-ui-mobile-bar
		class="pptx-vue-mobile-bar fixed bottom-0 left-0 right-0 z-40"
		:style="barStyle"
		:state.prop="state"
		@mobile-bar-request="request"
	/>
</template>
