<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
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
const now = ref(Date.now());
let intervalId: ReturnType<typeof setInterval> | null = null;

const elapsed = computed(() =>
	props.presentationStartTime ? now.value - props.presentationStartTime : 0,
);
const elapsedText = computed(() => formatElapsed(elapsed.value));

function onDocMouseDown(event: MouseEvent): void {
	const el = toolbarRef.value;
	if (el && !el.contains(event.target as Node)) {
		showPenColors.value = false;
		showHighlighterColors.value = false;
	}
}

onMounted(() => {
	if (props.presentationStartTime) {
		intervalId = setInterval(() => {
			now.value = Date.now();
		}, 1000);
	}
	document.addEventListener('mousedown', onDocMouseDown);
});

onBeforeUnmount(() => {
	if (intervalId !== null) {
		clearInterval(intervalId);
		intervalId = null;
	}
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

// Shared utility class strings mirroring the React `PresentationToolbar`.
const NAV_BTN_CLASS =
	'flex items-center justify-center w-9 h-9 rounded-md transition-colors text-white/70 hover:text-white hover:bg-white/10 disabled:text-white/20 disabled:cursor-not-allowed';

function toolClass(tool: PresentationTool): Array<string | Record<string, boolean>> {
	return [
		'pptx-vue-ptb-btn',
		'relative flex items-center justify-center w-9 h-9 rounded-md transition-colors',
		props.presentationTool === tool
			? 'pptx-vue-ptb-btn--active bg-white/25 text-white'
			: 'text-white/70 hover:text-white hover:bg-white/10',
	];
}
</script>

<template>
	<div
		ref="toolbarRef"
		class="pptx-vue-ptb flex items-center gap-1 rounded-xl border border-white/15 bg-neutral-900/90 px-3 py-2 shadow-2xl backdrop-blur-md"
		@click.stop
	>
		<!-- Previous -->
		<button
			type="button"
			class="pptx-vue-ptb-btn"
			:class="NAV_BTN_CLASS"
			:disabled="atFirst"
			:title="t('pptx.mobileBar.previousSlide')"
			:aria-label="t('pptx.mobileBar.previousSlide')"
			@click="emit('move', -1)"
		>
			‹
		</button>

		<span
			class="pptx-vue-ptb-counter min-w-[48px] select-none px-1.5 text-center font-mono text-xs tabular-nums text-white/80"
			>{{ counterText }}</span
		>

		<!-- Next -->
		<button
			type="button"
			class="pptx-vue-ptb-btn"
			:class="NAV_BTN_CLASS"
			:disabled="atLast"
			:title="t('pptx.mobileBar.nextSlide')"
			:aria-label="t('pptx.mobileBar.nextSlide')"
			@click="emit('move', 1)"
		>
			›
		</button>

		<div class="pptx-vue-ptb-divider mx-1 h-6 w-px bg-white/20" />

		<!-- Elapsed timer -->
		<div
			class="pptx-vue-ptb-timer flex select-none items-center gap-1.5 px-1 font-mono text-xs tabular-nums text-white/60"
			:title="t('pptx.mpresenter.elapsed')"
		>
			<span>⏱</span>
			<span>{{ elapsedText }}</span>
		</div>

		<div class="pptx-vue-ptb-divider mx-1 h-6 w-px bg-white/20" />

		<!-- Laser -->
		<button
			type="button"
			:class="toolClass('laser')"
			:title="t('pptx.presentation.laserPointer')"
			:aria-label="t('pptx.presentation.laserPointer')"
			@click="handleToolClick('laser')"
		>
			◉
		</button>

		<!-- Pen + colour dropdown -->
		<div class="pptx-vue-ptb-group relative flex items-center">
			<button
				type="button"
				:class="toolClass('pen')"
				:title="t('pptx.presentation.pen')"
				:aria-label="t('pptx.presentation.pen')"
				@click="handleToolClick('pen')"
				@contextmenu="onPenContextMenu"
			>
				✎
				<span
					class="pptx-vue-ptb-swatch absolute bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full"
					:style="{ backgroundColor: penColor }"
				/>
			</button>
			<button
				type="button"
				class="pptx-vue-ptb-caret -ml-1 flex h-9 w-[18px] items-center justify-center rounded-r-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
				:title="t('pptx.presentationToolbar.penColor')"
				:aria-label="t('pptx.presentationToolbar.penColor')"
				@click="togglePenColors"
			>
				▾
			</button>
			<div
				v-if="showPenColors"
				class="pptx-vue-ptb-palette absolute bottom-full left-1/2 mb-2 grid -translate-x-1/2 grid-cols-4 gap-2 rounded-lg border border-white/20 bg-neutral-800 p-3 shadow-xl"
			>
				<button
					v-for="color in PEN_COLORS"
					:key="color"
					type="button"
					class="pptx-vue-ptb-color h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
					:class="
						penColor === color ? 'pptx-vue-ptb-color--active border-white' : 'border-white/20'
					"
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
				:title="t('pptx.presentation.highlighter')"
				:aria-label="t('pptx.presentation.highlighter')"
				@click="handleToolClick('highlighter')"
				@contextmenu="onHighlighterContextMenu"
			>
				▤
				<span
					class="pptx-vue-ptb-swatch absolute bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full"
					:style="{ backgroundColor: highlighterColor }"
				/>
			</button>
			<button
				type="button"
				class="pptx-vue-ptb-caret -ml-1 flex h-9 w-[18px] items-center justify-center rounded-r-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
				:title="t('pptx.presentationToolbar.highlighterColor')"
				:aria-label="t('pptx.presentationToolbar.highlighterColor')"
				@click="toggleHighlighterColors"
			>
				▾
			</button>
			<div
				v-if="showHighlighterColors"
				class="pptx-vue-ptb-palette absolute bottom-full left-1/2 mb-2 grid -translate-x-1/2 grid-cols-4 gap-2 rounded-lg border border-white/20 bg-neutral-800 p-3 shadow-xl"
			>
				<button
					v-for="color in HIGHLIGHTER_COLORS"
					:key="color"
					type="button"
					class="pptx-vue-ptb-color h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
					:class="
						highlighterColor === color
							? 'pptx-vue-ptb-color--active border-white'
							: 'border-white/20'
					"
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
			:title="t('pptx.presentation.eraser')"
			:aria-label="t('pptx.presentation.eraser')"
			@click="handleToolClick('eraser')"
		>
			⌫
		</button>

		<!-- Clear all -->
		<button
			type="button"
			class="pptx-vue-ptb-btn flex h-9 w-9 items-center justify-center rounded-md transition-colors"
			:class="
				hasAnnotations
					? 'pptx-vue-ptb-btn--danger text-white/70 hover:bg-white/10 hover:text-red-400'
					: 'cursor-not-allowed text-white/30'
			"
			:disabled="!hasAnnotations"
			:title="t('pptx.presentationToolbar.clearAnnotations')"
			:aria-label="t('pptx.presentationToolbar.clearAnnotations')"
			@click="hasAnnotations && emit('clear-annotations')"
		>
			🗑
		</button>

		<div class="pptx-vue-ptb-divider mx-1 h-6 w-px bg-white/20" />

		<!-- Presenter view toggle -->
		<button
			v-if="showPresenterToggle"
			type="button"
			class="pptx-vue-ptb-btn flex h-9 w-9 items-center justify-center rounded-md transition-colors"
			:class="
				presenterMode
					? 'pptx-vue-ptb-btn--active bg-white/25 text-white'
					: 'text-white/70 hover:bg-white/10 hover:text-white'
			"
			:title="t('pptx.presentationToolbar.presenterView')"
			:aria-label="t('pptx.presentationToolbar.presenterView')"
			@click="emit('toggle-presenter-view')"
		>
			▥
		</button>

		<!-- End presentation -->
		<button
			type="button"
			class="pptx-vue-ptb-btn pptx-vue-ptb-btn--end flex h-9 w-9 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-red-400"
			:title="t('pptx.presenter.endPresentation')"
			:aria-label="t('pptx.presenter.endPresentation')"
			@click="emit('end-presentation')"
		>
			✕
		</button>
	</div>
</template>
