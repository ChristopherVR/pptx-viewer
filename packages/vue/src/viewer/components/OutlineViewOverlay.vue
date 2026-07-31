<script setup lang="ts">
/**
 * PowerPoint's Outline view.
 *
 * The deck as an editable indented text document: one row per slide title at
 * the left margin, that slide's body lines stepped in beneath it. Typing edits
 * the slide, Tab and Shift+Tab change a line's outline level, and Enter on a
 * title starts a new slide. See `render/outline-view` in `pptx-viewer-shared`
 * for the model, and `render/outline-view-edit` for what each gesture does and
 * (just as important) what it deliberately does not.
 *
 * Rendered as a full-window overlay rather than by replacing the thumbnail
 * pane, matching the slide sorter and reading view. Every binding then needs
 * one overlay instead of five different rebuilds of its own sidebar.
 *
 * Each row is a real `<input>`. A contenteditable would have to re-implement
 * caret placement, IME commit and undo per browser, and a list of one-line
 * inputs is exactly what the outline is.
 */
import { X } from 'lucide-vue-next';
import type { PptxSlide } from 'pptx-viewer-core';
import {
	OUTLINE_LEVEL_ATTR,
	OUTLINE_ROW_ATTR,
	OUTLINE_SLIDE_ATTR,
	OUTLINE_VIEW_ATTR,
} from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { useOutlineView } from '../composables/useOutlineView';
import type { CanvasSize } from '../types';

const props = defineProps<{
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	canEdit: boolean;
}>();

const emit = defineEmits<{
	close: [];
	/** The deck after an outline edit, plus the slide the editor should land on. */
	commit: [slides: PptxSlide[], activeSlideIndex: number];
}>();

const { t } = useI18n();

const { rows, containerRef, run, onRowKeyDown } = useOutlineView({
	slides: () => props.slides,
	canvasSize: () => props.canvasSize,
	canEdit: () => props.canEdit,
	commit: (slides, activeSlideIndex) => emit('commit', slides, activeSlideIndex),
});

/** Neutral markers `e2e/` addresses all five bindings through. */
const rootAttrs = { [OUTLINE_VIEW_ATTR]: 'true' };

/** Indent per outline level, in pixels. Level 0 (a title) sits flush left. */
const INDENT_PX = 22;

function rowAttrs(key: string, slideIndex: number, level: number): Record<string, string> {
	return {
		[OUTLINE_ROW_ATTR]: key,
		[OUTLINE_SLIDE_ATTR]: String(slideIndex + 1),
		[OUTLINE_LEVEL_ATTR]: String(level),
	};
}

function onInput(event: Event, key: string): void {
	run({ type: 'setText', key, text: (event.target as HTMLInputElement).value });
}
</script>

<template>
	<div
		v-bind="rootAttrs"
		class="pptx-vue-outline-view"
		role="region"
		:aria-label="t('pptx.view.outlineView')"
	>
		<div class="pptx-vue-outline-bar">
			<span class="pptx-vue-outline-title">{{ t('pptx.view.outlineView') }}</span>
			<span class="pptx-vue-outline-hint">{{ t('pptx.outline.hint') }}</span>
			<button
				type="button"
				class="pptx-vue-outline-control"
				:aria-label="t('pptx.statusBar.normalView')"
				:title="t('pptx.statusBar.normalView')"
				@click="emit('close')"
			>
				<X :size="16" aria-hidden="true" />
			</button>
		</div>

		<div ref="containerRef" class="pptx-vue-outline-rows">
			<div
				v-for="row in rows"
				:key="row.key"
				class="pptx-vue-outline-row"
				:style="{ paddingLeft: `${row.level * INDENT_PX}px` }"
			>
				<!--
					The slide number is drawn only on a slide's first row, which is
					always its title row, so the outline reads as a list of slides
					rather than as one undifferentiated wall of lines.
				-->
				<span class="pptx-vue-outline-number">{{
					row.kind === 'title' ? row.slideIndex + 1 : ''
				}}</span>
				<input
					v-bind="rowAttrs(row.key, row.slideIndex, row.level)"
					type="text"
					:value="row.text"
					:readonly="!canEdit"
					:class="
						row.kind === 'title' ? 'pptx-vue-outline-input is-title' : 'pptx-vue-outline-input'
					"
					:aria-label="t(row.kind === 'title' ? 'pptx.outline.titleLine' : 'pptx.outline.bodyLine')"
					@input="onInput($event, row.key)"
					@keydown="onRowKeyDown($event, row.key)"
				/>
			</div>
		</div>
	</div>
</template>

<style scoped>
/* Fills the window, not the screen: the outline never asks for fullscreen. */
.pptx-vue-outline-view {
	position: fixed;
	inset: 0;
	z-index: 1300;
	display: flex;
	flex-direction: column;
	background: #171717;
	color: #f5f5f5;
}

.pptx-vue-outline-bar {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.5rem 1rem;
	border-bottom: 1px solid rgb(255 255 255 / 0.1);
}

.pptx-vue-outline-title {
	font-size: 0.875rem;
	font-weight: 600;
}

.pptx-vue-outline-hint {
	flex: 1 1 auto;
	overflow: hidden;
	font-size: 0.6875rem;
	color: rgb(255 255 255 / 0.5);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pptx-vue-outline-control {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 2rem;
	height: 2rem;
	padding: 0;
	color: rgb(255 255 255 / 0.8);
	background: transparent;
	border: 0;
	border-radius: 0.25rem;
	cursor: pointer;
}

.pptx-vue-outline-control:hover {
	color: #ffffff;
	background: rgb(255 255 255 / 0.15);
}

.pptx-vue-outline-rows {
	flex: 1 1 auto;
	min-height: 0;
	overflow: auto;
	padding: 0.75rem 1rem;
}

.pptx-vue-outline-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.125rem 0;
}

.pptx-vue-outline-number {
	width: 1.5rem;
	flex: 0 0 auto;
	font-size: 0.625rem;
	font-variant-numeric: tabular-nums;
	color: rgb(255 255 255 / 0.4);
	text-align: right;
}

.pptx-vue-outline-input {
	width: 100%;
	padding: 0.125rem 0.25rem;
	font-size: 0.8125rem;
	color: rgb(255 255 255 / 0.8);
	background: transparent;
	border: 0;
	border-radius: 0.25rem;
	outline: none;
}

.pptx-vue-outline-input.is-title {
	font-size: 0.875rem;
	font-weight: 600;
	color: #f5f5f5;
}

.pptx-vue-outline-input:focus {
	background: rgb(255 255 255 / 0.1);
}
</style>
