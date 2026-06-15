<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
	formatSlideCounter,
	HIGHLIGHTER_COLORS,
	PEN_COLORS,
} from '../composables/presentation-toolbar-utils';
import { formatElapsed } from '../composables/presenter-view-utils';
import type { PresentationTool } from '../composables/usePresentationAnnotations';

/**
 * PresentationToolbar — floating control bar shown during presentation mode.
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
	(e: 'set-pen-color', color: string): void;
	(e: 'set-highlighter-color', color: string): void;
	(e: 'clear-annotations'): void;
	(e: 'move', direction: 1 | -1): void;
	(e: 'end-presentation'): void;
	(e: 'toggle-presenter-view'): void;
}>();

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

function toolClass(tool: PresentationTool): Record<string, boolean> {
	return {
		'pptx-vue-ptb-btn': true,
		'pptx-vue-ptb-btn--active': props.presentationTool === tool,
	};
}
</script>

<template>
	<div ref="toolbarRef" class="pptx-vue-ptb" @click.stop>
		<!-- Previous -->
		<button
			type="button"
			class="pptx-vue-ptb-btn"
			:disabled="atFirst"
			title="Previous slide"
			aria-label="Previous slide"
			@click="emit('move', -1)"
		>
			‹
		</button>

		<span class="pptx-vue-ptb-counter">{{ counterText }}</span>

		<!-- Next -->
		<button
			type="button"
			class="pptx-vue-ptb-btn"
			:disabled="atLast"
			title="Next slide"
			aria-label="Next slide"
			@click="emit('move', 1)"
		>
			›
		</button>

		<div class="pptx-vue-ptb-divider" />

		<!-- Elapsed timer -->
		<div class="pptx-vue-ptb-timer" title="Elapsed">
			<span>⏱</span>
			<span>{{ elapsedText }}</span>
		</div>

		<div class="pptx-vue-ptb-divider" />

		<!-- Laser -->
		<button
			type="button"
			:class="toolClass('laser')"
			title="Laser pointer"
			aria-label="Laser pointer"
			@click="handleToolClick('laser')"
		>
			◉
		</button>

		<!-- Pen + colour dropdown -->
		<div class="pptx-vue-ptb-group">
			<button
				type="button"
				:class="toolClass('pen')"
				title="Pen"
				aria-label="Pen"
				@click="handleToolClick('pen')"
				@contextmenu="onPenContextMenu"
			>
				✎
				<span class="pptx-vue-ptb-swatch" :style="{ backgroundColor: penColor }" />
			</button>
			<button
				type="button"
				class="pptx-vue-ptb-caret"
				title="Pen — colour"
				aria-label="Pen colour"
				@click="togglePenColors"
			>
				▾
			</button>
			<div v-if="showPenColors" class="pptx-vue-ptb-palette">
				<button
					v-for="color in PEN_COLORS"
					:key="color"
					type="button"
					class="pptx-vue-ptb-color"
					:class="{ 'pptx-vue-ptb-color--active': penColor === color }"
					:style="{ backgroundColor: color }"
					:aria-label="`Pen colour ${color}`"
					@click="pickPenColor(color)"
				/>
			</div>
		</div>

		<!-- Highlighter + colour dropdown -->
		<div class="pptx-vue-ptb-group">
			<button
				type="button"
				:class="toolClass('highlighter')"
				title="Highlighter"
				aria-label="Highlighter"
				@click="handleToolClick('highlighter')"
				@contextmenu="onHighlighterContextMenu"
			>
				▤
				<span class="pptx-vue-ptb-swatch" :style="{ backgroundColor: highlighterColor }" />
			</button>
			<button
				type="button"
				class="pptx-vue-ptb-caret"
				title="Highlighter — colour"
				aria-label="Highlighter colour"
				@click="toggleHighlighterColors"
			>
				▾
			</button>
			<div v-if="showHighlighterColors" class="pptx-vue-ptb-palette">
				<button
					v-for="color in HIGHLIGHTER_COLORS"
					:key="color"
					type="button"
					class="pptx-vue-ptb-color"
					:class="{ 'pptx-vue-ptb-color--active': highlighterColor === color }"
					:style="{ backgroundColor: color }"
					:aria-label="`Highlighter colour ${color}`"
					@click="pickHighlighterColor(color)"
				/>
			</div>
		</div>

		<!-- Eraser -->
		<button
			type="button"
			:class="toolClass('eraser')"
			title="Eraser"
			aria-label="Eraser"
			@click="handleToolClick('eraser')"
		>
			⌫
		</button>

		<!-- Clear all -->
		<button
			type="button"
			class="pptx-vue-ptb-btn"
			:class="{ 'pptx-vue-ptb-btn--danger': hasAnnotations }"
			:disabled="!hasAnnotations"
			title="Clear annotations"
			aria-label="Clear annotations"
			@click="hasAnnotations && emit('clear-annotations')"
		>
			🗑
		</button>

		<div class="pptx-vue-ptb-divider" />

		<!-- Presenter view toggle -->
		<button
			v-if="showPresenterToggle"
			type="button"
			class="pptx-vue-ptb-btn"
			:class="{ 'pptx-vue-ptb-btn--active': presenterMode }"
			title="Presenter view"
			aria-label="Presenter view"
			@click="emit('toggle-presenter-view')"
		>
			▥
		</button>

		<!-- End presentation -->
		<button
			type="button"
			class="pptx-vue-ptb-btn pptx-vue-ptb-btn--end"
			title="End presentation"
			aria-label="End presentation"
			@click="emit('end-presentation')"
		>
			✕
		</button>
	</div>
</template>

<style scoped>
.pptx-vue-ptb {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 8px 12px;
	border-radius: 12px;
	background: rgba(23, 23, 23, 0.9);
	backdrop-filter: blur(8px);
	border: 1px solid rgba(255, 255, 255, 0.15);
	box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
	font-family:
		system-ui,
		-apple-system,
		sans-serif;
}

.pptx-vue-ptb-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	width: 36px;
	height: 36px;
	border: none;
	border-radius: 8px;
	background: transparent;
	color: rgba(255, 255, 255, 0.7);
	font-size: 16px;
	line-height: 1;
	cursor: pointer;
	transition:
		background-color 0.15s,
		color 0.15s;
}

.pptx-vue-ptb-btn:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.1);
	color: #ffffff;
}

.pptx-vue-ptb-btn--active {
	background: rgba(255, 255, 255, 0.25);
	color: #ffffff;
}

.pptx-vue-ptb-btn--danger:hover {
	color: #f87171;
}

.pptx-vue-ptb-btn--end:hover {
	color: #f87171;
}

.pptx-vue-ptb-btn:disabled {
	color: rgba(255, 255, 255, 0.2);
	cursor: not-allowed;
}

.pptx-vue-ptb-counter {
	min-width: 48px;
	text-align: center;
	padding: 0 6px;
	font-size: 12px;
	font-family: ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
	color: rgba(255, 255, 255, 0.8);
	user-select: none;
}

.pptx-vue-ptb-divider {
	width: 1px;
	height: 24px;
	margin: 0 4px;
	background: rgba(255, 255, 255, 0.2);
}

.pptx-vue-ptb-timer {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 0 4px;
	font-size: 12px;
	font-family: ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
	color: rgba(255, 255, 255, 0.6);
	user-select: none;
}

.pptx-vue-ptb-group {
	display: flex;
	align-items: center;
	position: relative;
}

.pptx-vue-ptb-swatch {
	position: absolute;
	bottom: 3px;
	left: 50%;
	transform: translateX(-50%);
	width: 12px;
	height: 2px;
	border-radius: 999px;
}

.pptx-vue-ptb-caret {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 36px;
	margin-left: -4px;
	border: none;
	border-radius: 0 8px 8px 0;
	background: transparent;
	color: rgba(255, 255, 255, 0.5);
	font-size: 10px;
	cursor: pointer;
}

.pptx-vue-ptb-caret:hover {
	background: rgba(255, 255, 255, 0.1);
	color: #ffffff;
}

.pptx-vue-ptb-palette {
	position: absolute;
	bottom: 100%;
	left: 50%;
	transform: translateX(-50%);
	margin-bottom: 8px;
	padding: 12px;
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 8px;
	background: #262626;
	border-radius: 8px;
	border: 1px solid rgba(255, 255, 255, 0.2);
	box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
}

.pptx-vue-ptb-color {
	width: 32px;
	height: 32px;
	border-radius: 50%;
	border: 2px solid rgba(255, 255, 255, 0.2);
	cursor: pointer;
	transition: transform 0.15s;
}

.pptx-vue-ptb-color:hover {
	transform: scale(1.1);
}

.pptx-vue-ptb-color--active {
	border-color: #ffffff;
}
</style>
