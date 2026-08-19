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
 * Conventions vs. React: function-prop callbacks become emits. The Vue package
 * has a Tailwind build (see `src/styles/pptx-vue-viewer.css`), so the utility
 * classes are used directly, like React, rather than hand-written scoped CSS.
 */
import { Layers, MessageSquare, Plus, Settings2, StickyNote } from 'lucide-vue-next';
import type { ActionDescriptor } from 'pptx-viewer-shared';
import { buildBarActions } from 'pptx-viewer-shared';
import type { FunctionalComponent } from 'vue';
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

type TabKey = 'slides' | 'insert' | 'format' | 'comments' | 'notes';

interface Tab {
	/** Sheet key; `insert` is a fire action and never renders active. */
	key: TabKey;
	labelKey: string;
	icon: FunctionalComponent;
	/** Overrides the visible label as the accessible name (React does this for Notes). */
	ariaLabelKey?: string;
	badge?: number;
	disabled: boolean;
}

/**
 * Per-tab display metadata, plus the shared `buildBarActions` key each tab
 * maps from (the shared vocabulary calls the format tab `inspector`).
 */
const TAB_META: Record<
	TabKey,
	{ labelKey: string; icon: FunctionalComponent; sharedKey: ActionDescriptor['key'] }
> = {
	slides: { labelKey: 'pptx.sections.slides', icon: Layers, sharedKey: 'slides' },
	insert: { labelKey: 'pptx.mobileBar.insert', icon: Plus, sharedKey: 'insert' },
	format: { labelKey: 'pptx.field.format', icon: Settings2, sharedKey: 'inspector' },
	comments: { labelKey: 'pptx.toolbar.comments', icon: MessageSquare, sharedKey: 'comments' },
	notes: { labelKey: 'pptx.notes.title', icon: StickyNote, sharedKey: 'notes' },
};

// Shared `buildBarActions` decides which tabs are disabled (no slides
// loaded); this binding only maps the resulting descriptor onto its own
// icons, labels and click handlers.
const tabs = computed<Tab[]>(() => {
	const disabledBySharedKey = new Map(
		buildBarActions({ slideCount: props.slideCount ?? 0 }).map((descriptor) => [
			descriptor.key,
			descriptor.disabled,
		]),
	);
	return (Object.keys(TAB_META) as TabKey[]).map((key) => {
		const meta = TAB_META[key];
		return {
			key,
			labelKey: meta.labelKey,
			icon: meta.icon,
			ariaLabelKey: key === 'notes' ? 'pptx.statusBar.toggleNotes' : undefined,
			badge: key === 'comments' ? props.commentCount : undefined,
			disabled: disabledBySharedKey.get(meta.sharedKey) ?? false,
		};
	});
});

/**
 * Fire the emit for a tapped tab. Vue's typed `emit` is an overload set that
 * rejects a union argument, so dispatch each event name as a literal.
 */
function onTab(key: TabKey): void {
	switch (key) {
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

/** Comment-count badge text, capped at "99+" like the React mobile bar. */
function badgeText(count: number | undefined): string | null {
	if (count === undefined || count <= 0) {
		return null;
	}
	return count > 99 ? '99+' : String(count);
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
	<nav
		class="pptx-vue-mobile-bar fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-around border-t border-border bg-secondary/80 backdrop-blur supports-[backdrop-filter]:bg-secondary/60 pb-[max(env(safe-area-inset-bottom),0px)]"
		:style="barStyle"
		:aria-label="t('pptx.mobileBar.ariaLabel')"
	>
		<button
			v-for="tab in tabs"
			:key="tab.key"
			type="button"
			class="pptx-vue-mobile-tab relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] py-1.5 text-[10px] font-medium transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
			:class="
				activeSheet === tab.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
			"
			:disabled="tab.disabled"
			:aria-pressed="activeSheet === tab.key"
			:aria-label="tab.ariaLabelKey ? t(tab.ariaLabelKey) : undefined"
			@click="onTab(tab.key)"
		>
			<component :is="tab.icon" class="w-5 h-5" aria-hidden="true" />
			<span>{{ t(tab.labelKey) }}</span>
			<span
				v-if="badgeText(tab.badge)"
				class="pptx-vue-mobile-badge absolute top-1 right-1/4 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-semibold text-white"
				aria-hidden="true"
				>{{ badgeText(tab.badge) }}</span
			>
			<span
				v-if="activeSheet === tab.key"
				class="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary"
				aria-hidden="true"
			/>
		</button>
	</nav>
</template>
