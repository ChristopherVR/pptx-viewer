<script setup lang="ts">
/**
 * HandoutMasterCanvas: a faithful preview of the handout master page.
 *
 * Vue port of the React `HandoutMasterCanvas.tsx`. Renders a portrait page with
 * N slide placeholder slots arranged for the chosen slides-per-page (1/2/3/4/6/9)
 * plus header/date/footer/page-number corner indicators. Like the React version
 * this is a lighter-weight positioned-region preview (not a `SlideStage` render):
 * a handout master's content is the slot grid, not a full element tree.
 *
 * Optional `slideThumbnails` fill the slots with real slide previews.
 *
 * Props : `{ handoutMaster, canvasSize, slidesPerPage, slideThumbnails?, pageNumber? }`
 */
import type { PptxElement, PptxHandoutMaster } from 'pptx-viewer-core';
import { computeHandoutSlotLayout, DEFAULT_MASTER_PAGE_SIZE } from 'pptx-viewer-shared';
import type { MasterPageRect } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';

const props = defineProps<{
	handoutMaster: PptxHandoutMaster | undefined;
	canvasSize: CanvasSize;
	slidesPerPage: number;
	slideThumbnails?: string[];
	pageNumber?: number;
}>();

const { t } = useI18n();

/** Standard 4:3 slide aspect for slot placeholders. */
const SLIDE_ASPECT = 4 / 3;

const scale = computed(() => {
	const scaleX = props.canvasSize.width / DEFAULT_MASTER_PAGE_SIZE.width;
	const scaleY = props.canvasSize.height / DEFAULT_MASTER_PAGE_SIZE.height;
	return Math.min(scaleX, scaleY, 1) * 0.85;
});

const scaledWidth = computed(() => DEFAULT_MASTER_PAGE_SIZE.width * scale.value);
const scaledHeight = computed(() => DEFAULT_MASTER_PAGE_SIZE.height * scale.value);

const slots = computed(() => computeHandoutSlotLayout(props.slidesPerPage, SLIDE_ASPECT));

const pageStyle = computed<CSSProperties>(() => ({
	width: `${scaledWidth.value}px`,
	height: `${scaledHeight.value}px`,
}));

const cornerFontSize = computed(() => `${Math.max(6, 8 * scale.value)}px`);

function slotStyle(slot: MasterPageRect): CSSProperties {
	return {
		left: `${slot.x * scaledWidth.value}px`,
		top: `${slot.y * scaledHeight.value}px`,
		width: `${slot.w * scaledWidth.value}px`,
		height: `${slot.h * scaledHeight.value}px`,
	};
}

function thumbnailFor(index: number): string | undefined {
	return props.slideThumbnails?.[index];
}

function slotLabel(index: number): string {
	return t('pptx.notes.slideN', { n: index + 1 });
}

function elementText(element: PptxElement): string {
	if ('textSegments' in element && element.textSegments?.length) {
		return element.textSegments.map((segment) => segment.text).join('');
	}
	return 'text' in element ? (element.text ?? '') : '';
}

function elementStyle(element: PptxElement): CSSProperties {
	return {
		left: `${element.x * scale.value}px`,
		top: `${element.y * scale.value}px`,
		width: `${element.width * scale.value}px`,
		height: `${element.height * scale.value}px`,
	};
}

const pageNumberLabel = computed(() =>
	props.pageNumber !== undefined ? String(props.pageNumber) : t('pptx.handout.pageNumber'),
);
</script>

<template>
	<div class="pptx-vue-handout-master-canvas">
		<div
			v-if="!handoutMaster"
			class="pptx-vue-handout-master-canvas__empty"
			data-testid="handout-master-empty"
		>
			{{ t('pptx.master.noHandoutMaster') }}
		</div>

		<div
			v-else
			class="pptx-vue-handout-master-canvas__page"
			:style="pageStyle"
			data-testid="handout-master-page"
		>
			<div
				v-if="handoutMaster.backgroundColor"
				class="pptx-vue-handout-master-canvas__bg"
				:style="{ backgroundColor: handoutMaster.backgroundColor }"
			/>

			<div
				v-for="(slot, i) in slots"
				:key="i"
				class="pptx-vue-handout-master-canvas__slot"
				:class="{ 'pptx-vue-handout-master-canvas__slot--filled': Boolean(thumbnailFor(i)) }"
				:style="slotStyle(slot)"
				data-testid="handout-slot"
			>
				<img
					v-if="thumbnailFor(i)"
					class="pptx-vue-handout-master-canvas__slot-img"
					:src="thumbnailFor(i)"
					:alt="slotLabel(i)"
				/>
				<span v-else class="pptx-vue-handout-master-canvas__slot-label">{{
					t('pptx.notes.slideN', { n: i + 1 })
				}}</span>
			</div>
			<div
				v-for="element in handoutMaster.elements ?? []"
				:key="element.id"
				class="pptx-vue-handout-master-canvas__element"
				data-pptx-element="true"
				:data-element-id="element.id"
				:style="elementStyle(element)"
			>
				{{ elementText(element) }}
			</div>

			<div
				class="pptx-vue-handout-master-canvas__corner pptx-vue-handout-master-canvas__corner--tl"
				:style="{ fontSize: cornerFontSize }"
			>
				{{ t('pptx.field.header') }}
			</div>
			<div
				class="pptx-vue-handout-master-canvas__corner pptx-vue-handout-master-canvas__corner--tr"
				:style="{ fontSize: cornerFontSize }"
			>
				{{ t('pptx.handout.cornerDate') }}
			</div>
			<div
				class="pptx-vue-handout-master-canvas__corner pptx-vue-handout-master-canvas__corner--bl"
				:style="{ fontSize: cornerFontSize }"
			>
				{{ t('pptx.field.footer') }}
			</div>
			<div
				class="pptx-vue-handout-master-canvas__corner pptx-vue-handout-master-canvas__corner--br"
				:style="{ fontSize: cornerFontSize }"
			>
				{{ pageNumberLabel }}
			</div>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-handout-master-canvas {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
}

.pptx-vue-handout-master-canvas__empty {
	color: var(--pptx-vue-muted-foreground, #6b7280);
	font-size: 14px;
}

.pptx-vue-handout-master-canvas__element {
	position: absolute;
	z-index: 2;
	overflow: hidden;
}

.pptx-vue-handout-master-canvas__page {
	position: relative;
	background: #ffffff;
	border: 1px solid #d1d5db;
	border-radius: 4px;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.pptx-vue-handout-master-canvas__bg {
	position: absolute;
	inset: 0;
	border-radius: 4px;
}

.pptx-vue-handout-master-canvas__slot {
	position: absolute;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	border: 1px dashed rgba(96, 165, 250, 0.5);
	background: rgba(239, 246, 255, 0.3);
}

.pptx-vue-handout-master-canvas__slot--filled {
	border: 1px solid #d1d5db;
	background: transparent;
}

.pptx-vue-handout-master-canvas__slot-img {
	width: 100%;
	height: 100%;
	object-fit: contain;
}

.pptx-vue-handout-master-canvas__slot-label {
	font-size: 10px;
	font-weight: 500;
	color: rgba(96, 165, 250, 0.6);
}

.pptx-vue-handout-master-canvas__corner {
	position: absolute;
	padding: 0 4px;
	color: rgba(156, 163, 175, 0.5);
	border-style: dashed;
	border-color: rgba(209, 213, 219, 0.4);
}

.pptx-vue-handout-master-canvas__corner--tl {
	left: 0;
	top: 0;
	border-bottom-width: 1px;
	border-right-width: 1px;
}

.pptx-vue-handout-master-canvas__corner--tr {
	right: 0;
	top: 0;
	border-bottom-width: 1px;
	border-left-width: 1px;
}

.pptx-vue-handout-master-canvas__corner--bl {
	left: 0;
	bottom: 0;
	border-top-width: 1px;
	border-right-width: 1px;
}

.pptx-vue-handout-master-canvas__corner--br {
	right: 0;
	bottom: 0;
	border-top-width: 1px;
	border-left-width: 1px;
}
</style>
