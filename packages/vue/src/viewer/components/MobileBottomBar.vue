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

const props = defineProps<{
	/** Zero-based index of the active slide. */
	slideIndex: number;
	/** Total number of slides in the deck. */
	slideCount: number;
	/** Current zoom level, already expressed as a whole percentage. */
	zoomPercent: number;
	/** When true, surface the editor-only Format / Comments sheet triggers. */
	canEdit?: boolean;
}>();

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
		aria-label="Slide controls"
	>
		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			:disabled="atStart"
			aria-label="Previous slide"
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
			aria-label="Next slide"
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
			aria-label="Zoom out"
			@click="emit('zoom-out')"
		>
			<span aria-hidden="true">−</span>
		</button>

		<span class="pptx-vue-mobile-zoom" :class="MOBILE_LABEL" aria-label="Zoom level"
			>{{ zoomPercent }}%</span
		>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			aria-label="Zoom in"
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
			aria-label="Present"
			@click="emit('present')"
		>
			<span aria-hidden="true">▶</span>
		</button>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			aria-label="Slides"
			title="Slides panel"
			@click="emit('slides')"
		>
			<span aria-hidden="true">▦</span>
		</button>

		<button
			v-if="props.canEdit"
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			aria-label="Insert"
			title="Insert"
			@click="emit('insert')"
		>
			<span aria-hidden="true">＋</span>
		</button>

		<button
			v-if="props.canEdit"
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			aria-label="Format"
			title="Format / properties"
			@click="emit('format')"
		>
			<span aria-hidden="true">⚙</span>
		</button>

		<button
			v-if="props.canEdit"
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			aria-label="Comments"
			title="Comments"
			@click="emit('comments')"
		>
			<span aria-hidden="true">💬</span>
		</button>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			aria-label="Save"
			title="Save (.pptx)"
			@click="emit('save')"
		>
			<span aria-hidden="true">⤓</span>
		</button>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			aria-label="Notes"
			@click="emit('notes')"
		>
			<span aria-hidden="true">📝</span>
		</button>

		<button
			type="button"
			class="pptx-vue-mobile-btn"
			:class="MOBILE_BTN"
			aria-label="More actions"
			@click="emit('menu')"
		>
			<span aria-hidden="true">⋯</span>
		</button>
	</nav>
</template>
