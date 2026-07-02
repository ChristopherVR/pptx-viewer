<script setup lang="ts">
/**
 * MobileBottomBar - compact, touch-first bottom toolbar for the Vue
 * `pptx-vue-viewer` on small screens.
 *
 * Mirrors the control set of the React mobile chrome
 * (`packages/react/src/viewer/components/mobile/`): slide navigation, a slide
 * counter, zoom in/out, a present action, the React bottom-bar edit targets
 * (Slides / Insert / Format / Comments / Notes, gated on `canEdit`), Save, and
 * an overflow ("⋯") button that surfaces everything that does not fit on a
 * phone. The companion MobileToolbar carries the menu / undo / redo / share
 * controls. Glyphs reuse the Unicode characters from the desktop
 * `PowerPointViewer.vue` header (‹ › − +) so the two chromes read as one design
 * language.
 *
 * Conventions vs. React:
 *  - function-prop callbacks → emits.
 *  - Tailwind utility classes → scoped CSS (`pptx-vue-` prefix), since the Vue
 *    package ships hand-written styles rather than a Tailwind build.
 *
 * Every tap target is at least 44×44px (WCAG 2.5.5 / Apple HIG) and the bar is
 * pinned with `position: fixed; bottom: 0`, respecting the iOS safe-area inset.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
	/** Zero-based index of the active slide. */
	slideIndex: number;
	/** Total number of slides in the deck. */
	slideCount: number;
	/** Current zoom level, already expressed as a whole percentage. */
	zoomPercent: number;
	/** When true, surface the editor-only Format / Comments sheet triggers. */
	canEdit?: boolean;
	/**
	 * CSS pixels the on-screen keyboard covers. When > 0 the fixed bar lifts by
	 * this amount so it stays above the keyboard instead of under it.
	 */
	keyboardInset?: number;
	/** Number of comments on the active slide (renders a badge, capped at 99+). */
	commentCount?: number;
}>();

/** Comment-count badge text, capped at "99+" like the React mobile bar. */
const commentBadge = computed(() => {
	const count = props.commentCount ?? 0;
	if (count <= 0) {
		return null;
	}
	return count > 99 ? '99+' : String(count);
});

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

const emit = defineEmits<{
	prev: [];
	next: [];
	'zoom-in': [];
	'zoom-out': [];
	present: [];
	slides: [];
	insert: [];
	format: [];
	comments: [];
	save: [];
	notes: [];
	menu: [];
}>();

const atStart = computed(() => props.slideIndex <= 0);
const atEnd = computed(() => props.slideIndex >= props.slideCount - 1);
const counterLabel = computed(
	() => `${props.slideCount === 0 ? 0 : props.slideIndex + 1} / ${props.slideCount}`,
);

/**
 * Shared mobile-button utility classes: each control gets an equal flex share,
 * a ≥44px touch target, and React-style ghost hover/active states over semantic
 * tokens.
 */
const MOBILE_BTN =
	'inline-flex items-center justify-center flex-1 min-w-0 min-h-[44px] p-0 border-0 rounded-lg bg-transparent text-foreground text-xl leading-none cursor-pointer transition-[background-color,transform] duration-150 hover:bg-accent active:scale-[0.94] disabled:opacity-35 disabled:cursor-not-allowed';
const MOBILE_LABEL =
	'inline-flex items-center justify-center flex-1 min-w-0 min-h-[44px] px-0.5 text-xs tabular-nums text-muted-foreground select-none whitespace-nowrap';
</script>

<template>
	<nav
		class="pptx-vue-mobile-bar fixed bottom-0 left-0 right-0 z-40 flex items-stretch justify-between overflow-hidden p-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] border-t border-border bg-secondary/90 backdrop-blur-md"
		:style="barStyle"
		:aria-label="t('pptx.mobileBar.slideControls')"
	>
		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:disabled="atStart"
			:aria-label="t('pptx.mobileBar.previousSlide')"
			@click="emit('prev')"
		>
			<span aria-hidden="true">‹</span>
		</button>

		<span class="pptx-vue-mobile-counter" :class="MOBILE_LABEL" aria-live="polite">{{
			counterLabel
		}}</span>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:disabled="atEnd"
			:aria-label="t('pptx.mobileBar.nextSlide')"
			@click="emit('next')"
		>
			<span aria-hidden="true">›</span>
		</button>

		<span
			class="pptx-vue-mobile-divider flex-[0_0_1px] w-px my-2 mx-px bg-border"
			aria-hidden="true"
		/>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.statusBar.zoomOut')"
			@click="emit('zoom-out')"
		>
			<span aria-hidden="true">−</span>
		</button>

		<span
			class="pptx-vue-mobile-zoom"
			:class="MOBILE_LABEL"
			:aria-label="t('pptx.mobileBar.zoomLevel')"
			>{{ zoomPercent }}%</span
		>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.statusBar.zoomIn')"
			@click="emit('zoom-in')"
		>
			<span aria-hidden="true">+</span>
		</button>

		<span
			class="pptx-vue-mobile-divider flex-[0_0_1px] w-px my-2 mx-px bg-border"
			aria-hidden="true"
		/>

		<button
			type="button"
			class="pptx-vue-mobile-btn pptx-vue-mobile-present !text-primary"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.mobileBar.present')"
			@click="emit('present')"
		>
			<span aria-hidden="true">▶</span>
		</button>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.sections.slides')"
			:title="t('pptx.mobileBar.slidesPanel')"
			@click="emit('slides')"
		>
			<span aria-hidden="true">▦</span>
		</button>

		<button
			v-if="props.canEdit"
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.mobileBar.insert')"
			:title="t('pptx.mobileBar.insert')"
			@click="emit('insert')"
		>
			<span aria-hidden="true">＋</span>
		</button>

		<button
			v-if="props.canEdit"
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.arrange.format')"
			:title="t('pptx.mobileBar.formatTitle')"
			@click="emit('format')"
		>
			<span aria-hidden="true">⚙</span>
		</button>

		<button
			v-if="props.canEdit"
			type="button"
			class="pptx-vue-mobile-btn relative"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.toolbar.comments')"
			:title="t('pptx.toolbar.comments')"
			@click="emit('comments')"
		>
			<span aria-hidden="true">💬</span>
			<span
				v-if="commentBadge"
				class="pptx-vue-mobile-badge absolute top-1 right-1/4 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-semibold text-white"
				aria-hidden="true"
				>{{ commentBadge }}</span
			>
		</button>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.comments.save')"
			:title="t('pptx.mobileBar.saveTitle')"
			@click="emit('save')"
		>
			<span aria-hidden="true">⤓</span>
		</button>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.notes.title')"
			@click="emit('notes')"
		>
			<span aria-hidden="true">📝</span>
		</button>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:aria-label="t('pptx.mobileBar.moreActions')"
			@click="emit('menu')"
		>
			<span aria-hidden="true">⋯</span>
		</button>
	</nav>
</template>
