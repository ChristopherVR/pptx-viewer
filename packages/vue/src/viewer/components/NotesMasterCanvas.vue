<script setup lang="ts">
/**
 * NotesMasterCanvas - a faithful preview of the notes master page.
 *
 * Vue port of the React `NotesMasterCanvas.tsx`. The notes master is rendered as
 * a portrait page with labelled placeholder regions (slide image, body, header,
 * footer, date, page number). Unlike a slide master, a notes master has no
 * full-bleed element tree to render via {@link SlideStage}; its `placeholders`
 * are typed regions, so we draw a lighter-weight page with positioned region
 * boxes (matching React, which never used the slide renderer here either).
 *
 * Optional `slideThumbnail` / `notesText` / `slideNumber` fill the slide-image,
 * body, and page-number regions with real content when supplied.
 *
 * Props : `{ notesMaster, canvasSize, notesCanvasSize?, slideThumbnail?, notesText?, slideNumber? }`
 */
import type { PptxNotesMaster } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import type { CanvasSize } from '../types';

const props = defineProps<{
	notesMaster: PptxNotesMaster | undefined;
	canvasSize: CanvasSize;
	notesCanvasSize?: CanvasSize;
	slideThumbnail?: string;
	notesText?: string;
	slideNumber?: number;
}>();

/** Standard notes page proportions: US Letter portrait (7.5 x 10 inches). */
const DEFAULT_NOTES_WIDTH = 720;
const DEFAULT_NOTES_HEIGHT = 960;

/** Placeholder type → human-readable label. */
const PLACEHOLDER_LABELS: Record<string, string> = {
	sldImg: 'Slide Image',
	body: 'Notes Body',
	hdr: 'Header',
	ftr: 'Footer',
	dt: 'Date',
	sldNum: 'Page Number',
};

/** Default layout positions (fraction of page) for known placeholder types. */
const DEFAULT_POSITIONS: Record<string, { x: number; y: number; w: number; h: number }> = {
	sldImg: { x: 0.1, y: 0.05, w: 0.8, h: 0.4 },
	body: { x: 0.1, y: 0.5, w: 0.8, h: 0.4 },
	hdr: { x: 0.0, y: 0.0, w: 0.4, h: 0.04 },
	ftr: { x: 0.0, y: 0.96, w: 0.4, h: 0.04 },
	dt: { x: 0.6, y: 0.0, w: 0.4, h: 0.04 },
	sldNum: { x: 0.6, y: 0.96, w: 0.4, h: 0.04 },
};

interface PlaceholderRegion {
	type: string;
	idx?: string;
}

const pageWidth = computed(() => props.notesCanvasSize?.width ?? DEFAULT_NOTES_WIDTH);
const pageHeight = computed(() => props.notesCanvasSize?.height ?? DEFAULT_NOTES_HEIGHT);

const scale = computed(() => {
	const scaleX = props.canvasSize.width / pageWidth.value;
	const scaleY = props.canvasSize.height / pageHeight.value;
	return Math.min(scaleX, scaleY, 1) * 0.85;
});

const scaledWidth = computed(() => pageWidth.value * scale.value);
const scaledHeight = computed(() => pageHeight.value * scale.value);

const placeholders = computed<PlaceholderRegion[]>(() => {
	if (!props.notesMaster?.placeholders) {
		return [
			{ type: 'sldImg' },
			{ type: 'body' },
			{ type: 'hdr' },
			{ type: 'ftr' },
			{ type: 'dt' },
			{ type: 'sldNum' },
		];
	}
	return props.notesMaster.placeholders;
});

const pageStyle = computed<CSSProperties>(() => ({
	width: `${scaledWidth.value}px`,
	height: `${scaledHeight.value}px`,
}));

function regionStyle(type: string): CSSProperties {
	const pos = DEFAULT_POSITIONS[type];
	if (!pos) {
		return { display: 'none' };
	}
	return {
		left: `${pos.x * scaledWidth.value}px`,
		top: `${pos.y * scaledHeight.value}px`,
		width: `${pos.w * scaledWidth.value}px`,
		height: `${pos.h * scaledHeight.value}px`,
	};
}

function hasPosition(type: string): boolean {
	return Boolean(DEFAULT_POSITIONS[type]);
}

function labelFor(type: string): string {
	return PLACEHOLDER_LABELS[type] ?? type;
}

function regionKind(type: string): 'slide' | 'body' | 'plain' {
	if (type === 'sldImg') {
		return 'slide';
	}
	if (type === 'body') {
		return 'body';
	}
	return 'plain';
}
</script>

<template>
	<div class="pptx-vue-notes-master-canvas">
		<div
			v-if="!notesMaster"
			class="pptx-vue-notes-master-canvas__empty"
			data-testid="notes-master-empty"
		>
			No notes master
		</div>

		<div
			v-else
			class="pptx-vue-notes-master-canvas__page"
			:style="pageStyle"
			data-testid="notes-master-page"
		>
			<div
				v-if="notesMaster.backgroundColor"
				class="pptx-vue-notes-master-canvas__bg"
				:style="{ backgroundColor: notesMaster.backgroundColor }"
			/>

			<template v-for="ph in placeholders" :key="`${ph.type}-${ph.idx ?? 'default'}`">
				<div
					v-if="hasPosition(ph.type)"
					class="pptx-vue-notes-master-canvas__region"
					:class="`pptx-vue-notes-master-canvas__region--${regionKind(ph.type)}`"
					:style="regionStyle(ph.type)"
					:data-region="ph.type"
				>
					<img
						v-if="ph.type === 'sldImg' && slideThumbnail"
						class="pptx-vue-notes-master-canvas__slide-img"
						:src="slideThumbnail"
						:alt="slideNumber ? `Slide ${slideNumber}` : 'Slide'"
					/>
					<div
						v-else-if="ph.type === 'body' && notesText !== undefined"
						class="pptx-vue-notes-master-canvas__body-text"
					>
						{{ notesText || 'No notes' }}
					</div>
					<span v-else-if="ph.type === 'sldNum' && slideNumber !== undefined">{{
						slideNumber
					}}</span>
					<span v-else class="pptx-vue-notes-master-canvas__label">{{ labelFor(ph.type) }}</span>
				</div>
			</template>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-notes-master-canvas {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
}

.pptx-vue-notes-master-canvas__empty {
	color: var(--pptx-vue-muted-foreground, #6b7280);
	font-size: 14px;
}

.pptx-vue-notes-master-canvas__page {
	position: relative;
	background: #ffffff;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.pptx-vue-notes-master-canvas__bg {
	position: absolute;
	inset: 0;
	border-radius: 4px;
}

.pptx-vue-notes-master-canvas__region {
	position: absolute;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	border: 1px dashed rgba(156, 163, 175, 0.4);
	font-size: 10px;
	text-align: center;
	color: rgba(156, 163, 175, 0.7);
}

.pptx-vue-notes-master-canvas__region--slide {
	border-color: rgba(59, 130, 246, 0.5);
	background: rgba(59, 130, 246, 0.05);
	color: rgba(59, 130, 246, 0.7);
}

.pptx-vue-notes-master-canvas__region--body {
	border-color: rgba(34, 197, 94, 0.5);
	background: rgba(34, 197, 94, 0.05);
	color: rgba(34, 197, 94, 0.7);
	align-items: flex-start;
	justify-content: flex-start;
}

.pptx-vue-notes-master-canvas__slide-img {
	width: 100%;
	height: 100%;
	object-fit: contain;
}

.pptx-vue-notes-master-canvas__body-text {
	width: 100%;
	height: 100%;
	padding: 6px;
	overflow: auto;
	white-space: pre-wrap;
	text-align: left;
	color: #374151;
	line-height: 1.4;
	box-sizing: border-box;
}

.pptx-vue-notes-master-canvas__label {
	padding: 0 4px;
}
</style>
