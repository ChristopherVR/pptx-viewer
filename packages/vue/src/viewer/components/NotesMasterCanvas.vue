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
import type { PptxElement, PptxNotesMaster } from 'pptx-viewer-core';
import { resolveNotesSchematicBodyFontSizePx } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';

const props = defineProps<{
	notesMaster: PptxNotesMaster | undefined;
	canvasSize: CanvasSize;
	notesCanvasSize?: CanvasSize;
	slideThumbnail?: string;
	notesText?: string;
	slideNumber?: number;
}>();

const { t } = useI18n();

/** Standard notes page proportions: US Letter portrait (7.5 x 10 inches). */
const DEFAULT_NOTES_WIDTH = 720;
const DEFAULT_NOTES_HEIGHT = 960;

/** Placeholder type → human-readable label. */
const PLACEHOLDER_LABELS = computed<Record<string, string>>(() => ({
	sldImg: t('pptx.notesMaster.phSlideImage'),
	body: t('pptx.notesMaster.phNotesBody'),
	hdr: t('pptx.field.header'),
	ftr: t('pptx.field.footer'),
	dt: t('pptx.notesMaster.phDate'),
	sldNum: t('pptx.notesMaster.phPageNumber'),
}));

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

// Body-placeholder schematic font size: the deck's authored `<p:notesStyle>`
// level-0 default (shared cascade), scaled by this canvas's own preview
// ratio ON TOP of it, instead of the fixed `10px` CSS rule used before.
const bodyFontSize = computed(() =>
	resolveNotesSchematicBodyFontSizePx(props.notesMaster?.notesStyle, scale.value),
);

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
	return PLACEHOLDER_LABELS.value[type] ?? type;
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
</script>

<template>
	<div class="pptx-vue-notes-master-canvas">
		<div
			v-if="!notesMaster"
			class="pptx-vue-notes-master-canvas__empty"
			data-testid="notes-master-empty"
		>
			{{ t('pptx.notesMaster.empty') }}
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
						:alt="
							slideNumber
								? t('pptx.notes.slideN', { n: slideNumber })
								: t('pptx.notesMaster.slideAlt')
						"
					/>
					<div
						v-else-if="ph.type === 'body' && notesText !== undefined"
						class="pptx-vue-notes-master-canvas__body-text"
						:style="{ fontSize: `${bodyFontSize}px` }"
					>
						{{ notesText || t('pptx.notes.noNotes') }}
					</div>
					<span v-else-if="ph.type === 'sldNum' && slideNumber !== undefined">{{
						slideNumber
					}}</span>
					<span v-else class="pptx-vue-notes-master-canvas__label">{{ labelFor(ph.type) }}</span>
				</div>
			</template>
			<div
				v-for="element in notesMaster.elements ?? []"
				:key="element.id"
				class="pptx-vue-notes-master-canvas__element"
				data-pptx-element="true"
				:data-element-id="element.id"
				:style="elementStyle(element)"
			>
				{{ elementText(element) }}
			</div>
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

.pptx-vue-notes-master-canvas__element {
	position: absolute;
	z-index: 2;
	overflow: hidden;
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
