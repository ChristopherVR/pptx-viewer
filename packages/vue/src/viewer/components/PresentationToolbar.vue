<script setup lang="ts">
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Eraser,
	Highlighter,
	MousePointer2,
	PanelRight,
	PenTool,
	Timer,
	Trash2,
	X,
} from 'lucide-vue-next';
import { PRESENT_TOOLBAR_CLASSES } from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	formatSlideCounter,
	HIGHLIGHTER_COLORS,
	PEN_COLORS,
} from '../composables/presentation-toolbar-utils';
import { formatElapsed } from '../composables/presenter-view-utils';
import type { PresentationTool } from '../composables/usePresentationAnnotations';

/**
 * PresentationToolbar - floating control bar shown during presentation mode.
 *
 * Contains prev/next navigation, a slide counter, an elapsed timer, the
 * annotation-tool toggles (laser / pen / highlighter / eraser) with colour
 * dropdowns, a clear-all button, an optional presenter-view toggle, and an
 * end-presentation button. Vue port of the React `PresentationToolbar`.
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
	}>(),
	{ presenterMode: false, showPresenterToggle: false },
);

const emit = defineEmits<{
	(e: 'set-tool', tool: PresentationTool): void;
	(e: 'set-pen-color' | 'set-highlighter-color', color: string): void;
	(e: 'clear-annotations' | 'end-presentation' | 'toggle-presenter-view'): void;
	(e: 'move', direction: 1 | -1): void;
}>();

const { t } = useI18n();

const showPenColors = ref(false);
const showHighlighterColors = ref(false);
const toolbarRef = ref<HTMLDivElement | null>(null);

// -- Elapsed timer ----------------------------------------------------------
//
// `now` is re-seeded whenever the show (re)starts, and the interval is armed by
// a watcher rather than only on mount. The bar mounts BEFORE the host records
// `presentationStartTime`, so a mount-only interval never armed and the frozen
// mount-time `now` was subtracted from a LATER start time: the readout showed a
// negative elapsed ("-1:-1") for the whole show.
const now = ref(Date.now());
let intervalId: ReturnType<typeof setInterval> | null = null;

function stopTicking(): void {
	if (intervalId !== null) {
		clearInterval(intervalId);
		intervalId = null;
	}
}

function startTicking(): void {
	stopTicking();
	now.value = Date.now();
	intervalId = setInterval(() => {
		now.value = Date.now();
	}, 1000);
}

const elapsed = computed(() =>
	props.presentationStartTime ? Math.max(0, now.value - props.presentationStartTime) : 0,
);
const elapsedText = computed(() => formatElapsed(elapsed.value));

function onDocMouseDown(event: MouseEvent): void {
	const el = toolbarRef.value;
	if (el && !el.contains(event.target as Node)) {
		showPenColors.value = false;
		showHighlighterColors.value = false;
	}
}

watch(
	() => props.presentationStartTime,
	(startTime) => {
		if (startTime) {
			startTicking();
		} else {
			stopTicking();
		}
	},
	{ immediate: true },
);

onMounted(() => {
	document.addEventListener('mousedown', onDocMouseDown);
});

onBeforeUnmount(() => {
	stopTicking();
	document.removeEventListener('mousedown', onDocMouseDown);
});

const counterText = computed(() => formatSlideCounter(props.currentSlideIndex, props.totalSlides));
const atFirst = computed(() => props.currentSlideIndex === 0);
const atLast = computed(() => props.currentSlideIndex >= props.totalSlides - 1);

function handleToolClick(tool: PresentationTool): void {
	emit('set-tool', tool);
	showPenColors.value = false;
	showHighlighterColors.value = false;
}

function onPenContextMenu(event: MouseEvent): void {
	event.preventDefault();
	showPenColors.value = !showPenColors.value;
	showHighlighterColors.value = false;
}

function onHighlighterContextMenu(event: MouseEvent): void {
	event.preventDefault();
	showHighlighterColors.value = !showHighlighterColors.value;
	showPenColors.value = false;
}

function togglePenColors(): void {
	showPenColors.value = !showPenColors.value;
	showHighlighterColors.value = false;
}

function toggleHighlighterColors(): void {
	showHighlighterColors.value = !showHighlighterColors.value;
	showPenColors.value = false;
}

function pickPenColor(color: string): void {
	emit('set-pen-color', color);
	showPenColors.value = false;
	if (props.presentationTool !== 'pen') {
		emit('set-tool', 'pen');
	}
}

function pickHighlighterColor(color: string): void {
	emit('set-highlighter-color', color);
	showHighlighterColors.value = false;
	if (props.presentationTool !== 'highlighter') {
		emit('set-tool', 'highlighter');
	}
}

// The bar's look comes from `PRESENT_TOOLBAR_CLASSES` in `pptx-viewer-shared`,
// not from hand-copied utilities: copying them by hand is how this bar's colour
// carets ended up 18px wide against React's 28px.
const CLASSES = PRESENT_TOOLBAR_CLASSES;

function toolClass(tool: PresentationTool): string[] {
	return [
		'pptx-vue-ptb-btn',
		props.presentationTool === tool
			? `pptx-vue-ptb-btn--active ${CLASSES.toggleActive}`
			: CLASSES.toggle,
	];
}
</script>

<template>
	<div
		ref="toolbarRef"
		class="pptx-vue-ptb"
		:class="CLASSES.container"
		data-pptx-present-toolbar
		role="toolbar"
		:aria-label="t('pptx.toolbar.presentationToolbarAria')"
		@click.stop
	>
		<!-- Previous -->
		<button
			type="button"
			class="pptx-vue-ptb-btn"
			:class="CLASSES.button"
			data-pptx-present-control="previous"
			:disabled="atFirst"
			:title="t('pptx.presenter.previousSlide')"
			:aria-label="t('pptx.presenter.previousSlide')"
			@click="emit('move', -1)"
		>
			<ChevronLeft :size="18" aria-hidden="true" />
		</button>

		<span
			class="pptx-vue-ptb-counter"
			:class="CLASSES.counter"
			data-pptx-present-control="counter"
			>{{ counterText }}</span
		>

		<!-- Next -->
		<button
			type="button"
			class="pptx-vue-ptb-btn"
			:class="CLASSES.button"
			data-pptx-present-control="next"
			:disabled="atLast"
			:title="t('pptx.presenter.nextSlide')"
			:aria-label="t('pptx.presenter.nextSlide')"
			@click="emit('move', 1)"
		>
			<ChevronRight :size="18" aria-hidden="true" />
		</button>

		<div
			class="pptx-vue-ptb-divider"
			:class="CLASSES.divider"
			data-pptx-present-control="divider-navigation"
		/>

		<!-- Elapsed timer -->
		<div
			class="pptx-vue-ptb-timer"
			:class="CLASSES.timer"
			data-pptx-present-control="timer"
			:title="t('pptx.presenter.elapsed')"
			:aria-label="t('pptx.presenter.elapsed')"
		>
			<Timer :size="14" aria-hidden="true" />
			<span>{{ elapsedText }}</span>
		</div>

		<div
			class="pptx-vue-ptb-divider"
			:class="CLASSES.divider"
			data-pptx-present-control="divider-timer"
		/>

		<!-- Laser -->
		<button
			type="button"
			:class="toolClass('laser')"
			data-pptx-present-control="laser"
			:title="t('pptx.presentation.laserPointer')"
			:aria-label="t('pptx.presentation.laserPointer')"
			@click="handleToolClick('laser')"
		>
			<MousePointer2 :size="18" aria-hidden="true" />
		</button>

		<!-- Pen + colour dropdown -->
		<div class="pptx-vue-ptb-group relative flex items-center">
			<button
				type="button"
				:class="toolClass('pen')"
				data-pptx-present-control="pen"
				:title="t('pptx.presentation.pen')"
				:aria-label="t('pptx.presentation.pen')"
				@click="handleToolClick('pen')"
				@contextmenu="onPenContextMenu"
			>
				<PenTool :size="18" aria-hidden="true" />
				<span
					class="pptx-vue-ptb-swatch"
					:class="CLASSES.swatchBar"
					:style="{ backgroundColor: penColor }"
				/>
			</button>
			<button
				type="button"
				class="pptx-vue-ptb-caret"
				:class="CLASSES.caret"
				data-pptx-present-control="pen-color"
				data-pptx-compact
				:title="t('pptx.presentationToolbar.penColor')"
				:aria-label="t('pptx.presentationToolbar.penColor')"
				@click="togglePenColors"
			>
				<ChevronDown :size="12" aria-hidden="true" />
			</button>
			<div v-if="showPenColors" class="pptx-vue-ptb-palette" :class="CLASSES.palette">
				<button
					v-for="color in PEN_COLORS"
					:key="color"
					type="button"
					class="pptx-vue-ptb-color"
					:class="[
						CLASSES.swatch,
						penColor === color ? 'pptx-vue-ptb-color--active border-white' : 'border-white/20',
					]"
					:style="{ backgroundColor: color }"
					:aria-label="t('pptx.presentationToolbar.penColorValue', { color })"
					@click="pickPenColor(color)"
				/>
			</div>
		</div>

		<!-- Highlighter + colour dropdown -->
		<div class="pptx-vue-ptb-group relative flex items-center">
			<button
				type="button"
				:class="toolClass('highlighter')"
				data-pptx-present-control="highlighter"
				:title="t('pptx.presentation.highlighter')"
				:aria-label="t('pptx.presentation.highlighter')"
				@click="handleToolClick('highlighter')"
				@contextmenu="onHighlighterContextMenu"
			>
				<Highlighter :size="18" aria-hidden="true" />
				<span
					class="pptx-vue-ptb-swatch"
					:class="CLASSES.swatchBar"
					:style="{ backgroundColor: highlighterColor }"
				/>
			</button>
			<button
				type="button"
				class="pptx-vue-ptb-caret"
				:class="CLASSES.caret"
				data-pptx-present-control="highlighter-color"
				data-pptx-compact
				:title="t('pptx.presentationToolbar.highlighterColor')"
				:aria-label="t('pptx.presentationToolbar.highlighterColor')"
				@click="toggleHighlighterColors"
			>
				<ChevronDown :size="12" aria-hidden="true" />
			</button>
			<div v-if="showHighlighterColors" class="pptx-vue-ptb-palette" :class="CLASSES.palette">
				<button
					v-for="color in HIGHLIGHTER_COLORS"
					:key="color"
					type="button"
					class="pptx-vue-ptb-color"
					:class="[
						CLASSES.swatch,
						highlighterColor === color
							? 'pptx-vue-ptb-color--active border-white'
							: 'border-white/20',
					]"
					:style="{ backgroundColor: color }"
					:aria-label="t('pptx.presentationToolbar.highlighterColorValue', { color })"
					@click="pickHighlighterColor(color)"
				/>
			</div>
		</div>

		<!-- Eraser -->
		<button
			type="button"
			:class="toolClass('eraser')"
			data-pptx-present-control="eraser"
			:title="t('pptx.presentation.eraser')"
			:aria-label="t('pptx.presentation.eraser')"
			@click="handleToolClick('eraser')"
		>
			<Eraser :size="18" aria-hidden="true" />
		</button>

		<!-- Clear all -->
		<button
			type="button"
			class="pptx-vue-ptb-btn"
			:class="[CLASSES.button, hasAnnotations ? 'pptx-vue-ptb-btn--danger hover:text-red-400' : '']"
			data-pptx-present-control="clear"
			:disabled="!hasAnnotations"
			:title="t('pptx.presentation.clearAnnotations')"
			:aria-label="t('pptx.presentation.clearAnnotations')"
			@click="hasAnnotations && emit('clear-annotations')"
		>
			<Trash2 :size="18" aria-hidden="true" />
		</button>

		<div
			class="pptx-vue-ptb-divider"
			:class="CLASSES.divider"
			data-pptx-present-control="divider-tools"
		/>

		<!-- Presenter view toggle -->
		<button
			v-if="showPresenterToggle"
			type="button"
			class="pptx-vue-ptb-btn"
			:class="presenterMode ? `pptx-vue-ptb-btn--active ${CLASSES.toggleActive}` : CLASSES.toggle"
			data-pptx-present-control="presenter-view"
			:title="t('pptx.presenter.presenterView')"
			:aria-label="t('pptx.presenter.presenterView')"
			@click="emit('toggle-presenter-view')"
		>
			<PanelRight :size="18" aria-hidden="true" />
		</button>

		<!-- End presentation -->
		<button
			type="button"
			class="pptx-vue-ptb-btn pptx-vue-ptb-btn--end"
			:class="[CLASSES.button, 'hover:text-red-400']"
			data-pptx-present-control="end"
			:title="t('pptx.presenter.endPresentation')"
			:aria-label="t('pptx.presenter.endPresentation')"
			@click="emit('end-presentation')"
		>
			<X :size="18" aria-hidden="true" />
		</button>
	</div>
</template>
