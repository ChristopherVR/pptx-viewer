<script setup lang="ts">
/**
 * PrintDialog - full-featured print options dialog for the Vue viewer.
 *
 * Vue port of the React `PrintDialog.tsx`. Owns the print-settings state and,
 * on confirm, emits a resolved {@link PrintSettings} for the host to feed into
 * `usePrint().print(settings)`. Built on the reusable {@link ModalDialog} shell
 * and the {@link PrintSettingsPanel} fieldset; a lightweight live preview is
 * shown for the handout / notes layouts.
 *
 * Props:
 *  - `open`                  : visibility flag (host-owned).
 *  - `slides`                : the slides, for range bounds + outline preview.
 *  - `activeSlideIndex`      : current slide (for "current slide" range).
 *  - `defaultSlidesPerPage?` : seed from presentation props (clamped to valid).
 *  - `defaultFrameSlides?`   : seed from presentation props.
 *
 * Emits:
 *  - `print` : `PrintSettings`, the user confirmed; run the print flow.
 *  - `close` : the dialog was dismissed.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { computed, ref, watch } from 'vue';

import ModalDialog from './ModalDialog.vue';
import {
	computePageCount,
	computeSlideCount,
	computeSlideIndices,
	effectiveOrientation,
	getHandoutGrid,
	resolveSlidesPerPage,
} from './print-dialog-types';
import type {
	HandoutSlidesPerPage,
	PrintColorMode,
	PrintOrientation,
	PrintSettings,
	PrintSlideRange,
	PrintWhat,
} from './print-dialog-types';
import PrintSettingsPanel from './PrintSettingsPanel.vue';

const props = defineProps<{
	open: boolean;
	slides: PptxSlide[];
	activeSlideIndex: number;
	defaultSlidesPerPage?: number;
	defaultFrameSlides?: boolean;
}>();

const emit = defineEmits<{
	print: [settings: PrintSettings];
	close: [];
}>();

// ── State ──────────────────────────────────────────────────────────────
const printWhat = ref<PrintWhat>('slides');
const orientation = ref<PrintOrientation>('landscape');
const colorMode = ref<PrintColorMode>('color');
const frameSlides = ref<boolean>(props.defaultFrameSlides ?? false);
const slidesPerPage = ref<HandoutSlidesPerPage>(resolveSlidesPerPage(props.defaultSlidesPerPage));
const slideRange = ref<PrintSlideRange>('all');
const customFrom = ref<number>(1);
const customTo = ref<number>(props.slides.length);

/** Re-seed the form from the props each time the dialog opens. */
watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			printWhat.value = 'slides';
			orientation.value = 'landscape';
			colorMode.value = 'color';
			frameSlides.value = props.defaultFrameSlides ?? false;
			slidesPerPage.value = resolveSlidesPerPage(props.defaultSlidesPerPage);
			slideRange.value = 'all';
			customFrom.value = 1;
			customTo.value = props.slides.length;
		}
	},
);

// ── Derived ────────────────────────────────────────────────────────────
const totalSlides = computed(() => props.slides.length);

const resolvedOrientation = computed<PrintOrientation>(() =>
	effectiveOrientation(printWhat.value, orientation.value),
);

const slideCount = computed(() =>
	computeSlideCount(slideRange.value, totalSlides.value, customFrom.value, customTo.value),
);

const pageCount = computed(() =>
	computePageCount(printWhat.value, slideCount.value, slidesPerPage.value),
);

const previewSlideIndices = computed(() =>
	computeSlideIndices(
		slideRange.value,
		props.activeSlideIndex,
		totalSlides.value,
		customFrom.value,
		customTo.value,
	),
);

const handoutGrid = computed(() => getHandoutGrid(slidesPerPage.value));

const showHandoutPreview = computed(() => printWhat.value === 'handouts');
const showNotesPreview = computed(() => printWhat.value === 'notes');

// ── Handlers ───────────────────────────────────────────────────────────
function close(): void {
	emit('close');
}

function confirmPrint(): void {
	emit('print', {
		printWhat: printWhat.value,
		orientation: resolvedOrientation.value,
		colorMode: colorMode.value,
		frameSlides: frameSlides.value,
		slidesPerPage: slidesPerPage.value,
		slideRange: slideRange.value,
		customRangeFrom: Math.max(1, Math.min(customFrom.value, totalSlides.value || 1)),
		customRangeTo: Math.max(1, Math.min(customTo.value, totalSlides.value || 1)),
	});
}
</script>

<template>
	<ModalDialog :open="open" title="Print" @close="close">
		<div class="pptx-vue-print-body flex min-w-[480px] gap-5 max-md:min-w-0 max-md:flex-col">
			<PrintSettingsPanel
				:print-what="printWhat"
				:orientation="orientation"
				:color-mode="colorMode"
				:frame-slides="frameSlides"
				:slides-per-page="slidesPerPage"
				:slide-range="slideRange"
				:custom-from="customFrom"
				:custom-to="customTo"
				:total-slides="totalSlides"
				:active-slide-index="activeSlideIndex"
				@update:print-what="printWhat = $event"
				@update:orientation="orientation = $event"
				@update:color-mode="colorMode = $event"
				@update:frame-slides="frameSlides = $event"
				@update:slides-per-page="slidesPerPage = $event"
				@update:slide-range="slideRange = $event"
				@update:custom-from="customFrom = $event"
				@update:custom-to="customTo = $event"
			/>

			<!-- Lightweight preview for handout / notes layouts -->
			<div
				v-if="showHandoutPreview || showNotesPreview"
				class="pptx-vue-print-preview flex w-[180px] shrink-0 flex-col items-center gap-2.5 border-l border-border pl-4 max-md:w-full max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-4"
			>
				<span
					class="pptx-vue-print-preview-title text-[10px] uppercase tracking-wide text-muted-foreground"
				>
					Preview
				</span>

				<div
					v-if="previewSlideIndices.length === 0"
					class="pptx-vue-print-preview-empty flex h-full items-center justify-center text-xs text-muted-foreground"
				>
					No slides
				</div>

				<!-- Handout grid preview -->
				<div
					v-else-if="showHandoutPreview"
					class="pptx-vue-print-preview-page"
					:style="{
						display: 'grid',
						gridTemplateColumns: `repeat(${handoutGrid.columns}, 1fr)`,
						gridTemplateRows: `repeat(${handoutGrid.rows}, 1fr)`,
					}"
				>
					<div
						v-for="cellIndex in handoutGrid.rows * handoutGrid.columns"
						:key="cellIndex"
						class="pptx-vue-print-preview-cell"
						:class="{ 'pptx-vue-print-preview-cell--framed': frameSlides }"
					>
						<span v-if="previewSlideIndices[cellIndex - 1] !== undefined">
							{{ previewSlideIndices[cellIndex - 1] + 1 }}
						</span>
					</div>
				</div>

				<!-- Notes preview -->
				<div v-else class="pptx-vue-print-preview-notes-page">
					<div
						class="pptx-vue-print-preview-cell"
						:class="{ 'pptx-vue-print-preview-cell--framed': frameSlides }"
					>
						<span>{{ (previewSlideIndices[0] ?? 0) + 1 }}</span>
					</div>
					<div class="pptx-vue-print-preview-lines">
						<div v-for="line in 5" :key="line" class="pptx-vue-print-preview-line" />
					</div>
				</div>
			</div>
		</div>

		<template #footer>
			<span class="pptx-vue-print-estimate mr-auto text-xs text-muted-foreground">
				{{ pageCount }} {{ pageCount === 1 ? 'page' : 'pages' }} · {{ slideCount }}
				{{ slideCount === 1 ? 'slide' : 'slides' }}
			</span>
			<button
				type="button"
				class="pptx-vue-print-btn pptx-vue-print-btn--secondary rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				@click="close"
			>
				Cancel
			</button>
			<button
				type="button"
				class="pptx-vue-print-btn pptx-vue-print-btn--primary rounded-lg bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/90"
				@click="confirmPrint"
			>
				Print
			</button>
		</template>
	</ModalDialog>
</template>

<style scoped>
.pptx-vue-print-preview-page {
	width: 130px;
	height: 184px;
	gap: 4px;
	padding: 6px;
	background: #ffffff;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.pptx-vue-print-preview-notes-page {
	display: flex;
	flex-direction: column;
	gap: 6px;
	width: 130px;
	height: 184px;
	padding: 8px;
	background: #ffffff;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.pptx-vue-print-preview-notes-page .pptx-vue-print-preview-cell {
	height: 70px;
}

.pptx-vue-print-preview-cell {
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f9fafb;
	border: 1px solid #d1d5db;
	border-radius: 2px;
	font-size: 9px;
	font-weight: 500;
	color: #9ca3af;
}

.pptx-vue-print-preview-cell--framed {
	border: 2px solid #1f2937;
}

.pptx-vue-print-preview-lines {
	display: flex;
	flex-direction: column;
	justify-content: space-evenly;
	flex: 1;
	padding: 0 2px;
}

.pptx-vue-print-preview-line {
	height: 0;
	border-bottom: 1px solid #d1d5db;
}
</style>
