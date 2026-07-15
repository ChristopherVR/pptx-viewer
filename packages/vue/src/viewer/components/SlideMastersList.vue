<script setup lang="ts">
/**
 * SlideMastersList - the list of slide masters and their layouts in the master
 * view, each shown as a scaled live preview.
 *
 * Vue port of the React `SlideMastersList.tsx`. A `PptxSlideMaster` /
 * `PptxSlideLayout` carries `elements` + `backgroundColor`/`backgroundImage`, so
 * each is render-compatible with {@link SlideStage}; we build a pseudo
 * `PptxSlide` (mirroring React's `masterToSlide` / `layoutToSlide`) and render it
 * scaled down, giving a faithful preview that reuses the real renderer instead
 * of a lighter-weight approximation.
 *
 * Presentational only: selection is surfaced via emits.
 *
 * Props : `{ slideMasters, activeMasterIndex, activeLayoutIndex, canvasSize, mediaDataUrls }`
 * Emits : `select-master: [index]`, `select-layout: [masterIndex, layoutIndex]`
 */
import type { PptxSlide, PptxSlideMaster, PptxSlideLayout } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

const { t } = useI18n();

const props = defineProps<{
	slideMasters: PptxSlideMaster[];
	activeMasterIndex: number;
	activeLayoutIndex: number | null;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
}>();

const emit = defineEmits<{
	'select-master': [index: number];
	'select-layout': [masterIndex: number, layoutIndex: number];
}>();

/** Fixed preview width (px) for a master tile; layout tiles are smaller. */
const MASTER_TILE_WIDTH = 184;
const LAYOUT_TILE_WIDTH = 150;

const masterScale = computed(() => MASTER_TILE_WIDTH / Math.max(1, props.canvasSize.width));
const layoutScale = computed(() => LAYOUT_TILE_WIDTH / Math.max(1, props.canvasSize.width));

const masterTileHeight = computed(() => Math.round(props.canvasSize.height * masterScale.value));
const layoutTileHeight = computed(() => Math.round(props.canvasSize.height * layoutScale.value));

const masterStageWrapStyle = computed<CSSProperties>(() => ({
	width: `${MASTER_TILE_WIDTH}px`,
	height: `${masterTileHeight.value}px`,
}));

const layoutStageWrapStyle = computed<CSSProperties>(() => ({
	width: `${LAYOUT_TILE_WIDTH}px`,
	height: `${layoutTileHeight.value}px`,
}));

/** Build a pseudo-`PptxSlide` so a master can be rendered by `SlideStage`. */
function masterToSlide(master: PptxSlideMaster): PptxSlide {
	return {
		id: master.path,
		rId: '',
		slideNumber: 0,
		elements: master.elements ?? [],
		backgroundColor: master.backgroundColor,
		backgroundImage: master.backgroundImage,
	};
}

/** Build a pseudo-`PptxSlide` so a layout can be rendered by `SlideStage`. */
function layoutToSlide(layout: PptxSlideLayout): PptxSlide {
	return {
		id: layout.path,
		rId: '',
		slideNumber: 0,
		elements: layout.elements ?? [],
		backgroundColor: layout.backgroundColor,
		backgroundImage: layout.backgroundImage,
	};
}

function isMasterActive(masterIdx: number): boolean {
	return masterIdx === props.activeMasterIndex && props.activeLayoutIndex === null;
}

function isLayoutActive(masterIdx: number, layoutIdx: number): boolean {
	return masterIdx === props.activeMasterIndex && layoutIdx === props.activeLayoutIndex;
}
</script>

<template>
	<div class="pptx-vue-masters-list">
		<div
			v-for="(master, masterIdx) in slideMasters"
			:key="master.path"
			class="pptx-vue-masters-list__group"
		>
			<button
				type="button"
				class="pptx-vue-masters-list__master"
				:class="{ 'pptx-vue-masters-list__master--active': isMasterActive(masterIdx) }"
				:aria-current="isMasterActive(masterIdx) ? 'true' : undefined"
				:data-testid="`master-${masterIdx}`"
				@click="emit('select-master', masterIdx)"
			>
				<div class="pptx-vue-masters-list__thumb" :style="masterStageWrapStyle">
					<SlideStage
						:slide="masterToSlide(master)"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:scale="masterScale"
					/>
				</div>
				<span class="pptx-vue-masters-list__label">{{
					master.name || t('pptx.master.title')
				}}</span>
			</button>

			<div v-if="(master.layouts?.length ?? 0) > 0" class="pptx-vue-masters-list__layouts">
				<button
					type="button"
					v-for="(layout, layoutIdx) in master.layouts ?? []"
					:key="layout.path"
					class="pptx-vue-masters-list__layout"
					:class="{ 'pptx-vue-masters-list__layout--active': isLayoutActive(masterIdx, layoutIdx) }"
					:aria-current="isLayoutActive(masterIdx, layoutIdx) ? 'true' : undefined"
					:data-testid="`layout-${masterIdx}-${layoutIdx}`"
					@click="emit('select-layout', masterIdx, layoutIdx)"
				>
					<div class="pptx-vue-masters-list__thumb" :style="layoutStageWrapStyle">
						<SlideStage
							:slide="layoutToSlide(layout)"
							:canvas-size="canvasSize"
							:media-data-urls="mediaDataUrls"
							:scale="layoutScale"
						/>
					</div>
					<span class="pptx-vue-masters-list__label pptx-vue-masters-list__label--layout">
						{{ layout.name || t('pptx.master.layout') }}
					</span>
				</button>
			</div>
		</div>

		<div v-if="slideMasters.length === 0" class="pptx-vue-masters-list__empty">
			{{ t('pptx.master.noSlideMasters') }}
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-masters-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.pptx-vue-masters-list__group {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.pptx-vue-masters-list__master,
.pptx-vue-masters-list__layout {
	width: 100%;
	color: inherit;
	font: inherit;
	text-align: inherit;
	cursor: pointer;
	border: 2px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 8px;
	padding: 4px;
	background: rgba(255, 255, 255, 0.04);
	transition:
		border-color 0.15s ease,
		background 0.15s ease;
}

.pptx-vue-masters-list__layout {
	border-radius: 6px;
	padding: 2px;
}

.pptx-vue-masters-list__master:hover,
.pptx-vue-masters-list__layout:hover {
	border-color: var(--pptx-vue-muted-foreground, #9ca3af);
}

.pptx-vue-masters-list__master--active {
	border-color: #f59e0b;
	background: rgba(245, 158, 11, 0.1);
}

.pptx-vue-masters-list__layout--active {
	border-color: var(--pptx-vue-primary, #2563eb);
	background: rgba(37, 99, 235, 0.1);
}

.pptx-vue-masters-list__thumb {
	position: relative;
	overflow: hidden;
	border-radius: 4px;
	background: #ffffff;
}

.pptx-vue-masters-list__layouts {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-left: 12px;
	padding-left: 8px;
	border-left: 1px solid var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-masters-list__label {
	display: block;
	margin-top: 4px;
	padding: 0 2px;
	font-size: 10px;
	font-weight: 500;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.pptx-vue-masters-list__label--layout {
	font-size: 9px;
	font-weight: 400;
}

.pptx-vue-masters-list__master--active .pptx-vue-masters-list__label {
	color: #f59e0b;
}

.pptx-vue-masters-list__layout--active .pptx-vue-masters-list__label {
	color: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-masters-list__empty {
	padding: 16px 8px;
	text-align: center;
	font-size: 12px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}
</style>
