<script setup lang="ts">
/**
 * SectionList — collapsible section headers grouping the slide thumbnails.
 *
 * Vue counterpart of the React slides-pane section UI (`SectionHeader.tsx` +
 * `SectionContextMenu.tsx`). It renders one header per section group (plus a
 * leading no-section group), each followed by its slide thumbnails when the
 * section is expanded. Headers support:
 *  - click to toggle collapse,
 *  - double-click to start an inline rename (Enter commits, Escape cancels),
 *  - up/down/delete affordances on hover.
 *  - an "Add section" button at the foot of each group's first slide.
 *
 * Presentational only — all state lives in the host. It receives the
 * `slidesBySection` grouping from `useSectionOperations` and emits the
 * operations back: `toggle-collapse`, `rename`, `move-up`, `move-down`,
 * `delete`, `add-section` (after a slide index), and `select` (a slide).
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { ComponentPublicInstance, CSSProperties } from 'vue';
import { computed, nextTick, ref } from 'vue';

import type { SectionGroup } from '../composables/useSectionOperations';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

const props = defineProps<{
	/** Slides grouped by section (from `useSectionOperations().slidesBySection`). */
	groups: SectionGroup[];
	/** Canvas dimensions, for scaling thumbnails. */
	canvasSize: CanvasSize;
	/** Media data-URL map, threaded to `SlideStage`. */
	mediaDataUrls: Map<string, string>;
	/** Index of the currently active slide (for highlighting). */
	activeIndex: number;
	/** When false, edit affordances (rename/add/move/delete) are hidden. */
	canEdit?: boolean;
}>();

const emit = defineEmits<{
	/** A slide thumbnail was clicked (0-based deck index). */
	select: [index: number];
	/** Toggle a section's collapsed state. */
	'toggle-collapse': [sectionId: string];
	/** Commit a section rename. */
	rename: [sectionId: string, name: string];
	/** Move a section one position earlier. */
	'move-up': [sectionId: string];
	/** Move a section one position later. */
	'move-down': [sectionId: string];
	/** Delete a section. */
	delete: [sectionId: string];
	/** Add a new section after the given slide index. */
	'add-section': [afterSlideIndex: number];
}>();

/** Fixed thumbnail width (px); height derives from the canvas aspect ratio. */
const TILE_WIDTH = 168;

const tileScale = computed(() => TILE_WIDTH / Math.max(1, props.canvasSize.width));
const tileHeight = computed(() => Math.round(props.canvasSize.height * tileScale.value));

const stageWrapStyle = computed<CSSProperties>(() => ({
	width: `${TILE_WIDTH}px`,
	height: `${tileHeight.value}px`,
}));

const sectionCount = computed(() => props.groups.filter((g) => g.section !== undefined).length);

/** The section id currently being renamed, or `null` when idle. */
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const renameInput = ref<HTMLInputElement | null>(null);

/**
 * Template-ref callback for the rename `<input>`. Because the input lives inside
 * a `v-for`, a plain template ref would collect an array; this captures the
 * single mounted instance (only one exists at a time, gated by `renamingId`).
 */
function setRenameInput(el: Element | ComponentPublicInstance | null): void {
	renameInput.value = el instanceof HTMLInputElement ? el : null;
}

function isCollapsed(group: SectionGroup): boolean {
	return group.section?.collapsed === true;
}

function onSelect(index: number): void {
	emit('select', index);
}

function onHeaderClick(group: SectionGroup): void {
	if (group.section && renamingId.value !== group.section.id) {
		emit('toggle-collapse', group.section.id);
	}
}

async function startRename(sectionId: string, current: string): Promise<void> {
	if (props.canEdit === false) {
		return;
	}
	renamingId.value = sectionId;
	renameValue.value = current;
	await nextTick();
	renameInput.value?.focus();
	renameInput.value?.select();
}

function commitRename(): void {
	const id = renamingId.value;
	if (id === null) {
		return;
	}
	const name = renameValue.value.trim();
	renamingId.value = null;
	if (name.length > 0) {
		emit('rename', id, name);
	}
}

function cancelRename(): void {
	renamingId.value = null;
}

function onRenameKeydown(event: KeyboardEvent): void {
	if (event.key === 'Enter') {
		event.preventDefault();
		commitRename();
	} else if (event.key === 'Escape') {
		event.preventDefault();
		cancelRename();
	}
	event.stopPropagation();
}

function lastSlideIndex(group: SectionGroup): number {
	return group.slideIndexes[group.slideIndexes.length - 1] ?? -1;
}

function slideLabel(slide: PptxSlide, index: number): string {
	return `Slide ${slide.slideNumber || index + 1}`;
}
</script>

<template>
	<div class="pptx-vue-section-list">
		<div
			v-for="(group, gi) in props.groups"
			:key="group.section?.id ?? `__nosection-${gi}`"
			class="pptx-vue-section-group"
		>
			<!-- Section header (omitted for the leading no-section group). -->
			<div v-if="group.section" class="pptx-vue-section-header">
				<button
					type="button"
					class="pptx-vue-section-toggle"
					:aria-expanded="!isCollapsed(group)"
					:title="isCollapsed(group) ? 'Expand section' : 'Collapse section'"
					@click="onHeaderClick(group)"
					@dblclick.stop="startRename(group.section.id, group.section.name)"
				>
					<svg
						class="pptx-vue-section-chevron"
						:class="{ 'is-collapsed': isCollapsed(group) }"
						viewBox="0 0 16 16"
						width="12"
						height="12"
						aria-hidden="true"
						focusable="false"
					>
						<path
							d="M4 6l4 4 4-4"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>

					<input
						v-if="renamingId === group.section.id"
						:ref="setRenameInput"
						v-model="renameValue"
						class="pptx-vue-section-rename"
						type="text"
						@keydown="onRenameKeydown"
						@blur="commitRename"
						@click.stop
					/>
					<template v-else>
						<span class="pptx-vue-section-name">{{ group.section.name }}</span>
						<span class="pptx-vue-section-count">{{ group.slides.length }}</span>
					</template>
				</button>

				<div
					v-if="props.canEdit !== false && renamingId !== group.section.id"
					class="pptx-vue-section-actions"
				>
					<button
						type="button"
						class="pptx-vue-section-action"
						title="Move section up"
						aria-label="Move section up"
						@click="emit('move-up', group.section.id)"
					>
						▲
					</button>
					<button
						type="button"
						class="pptx-vue-section-action"
						title="Move section down"
						aria-label="Move section down"
						@click="emit('move-down', group.section.id)"
					>
						▼
					</button>
					<button
						type="button"
						class="pptx-vue-section-action pptx-vue-section-action--danger"
						title="Delete section"
						aria-label="Delete section"
						@click="emit('delete', group.section.id)"
					>
						×
					</button>
				</div>
			</div>

			<!-- Slide thumbnails for this group (hidden while collapsed). -->
			<ul v-show="!isCollapsed(group)" class="pptx-vue-section-slides">
				<li
					v-for="(slide, si) in group.slides"
					:key="slide.id ?? group.slideIndexes[si]"
					class="pptx-vue-section-slide"
					:class="{ 'is-active': group.slideIndexes[si] === props.activeIndex }"
				>
					<button
						type="button"
						class="pptx-vue-section-thumb"
						:title="slideLabel(slide, group.slideIndexes[si])"
						:aria-label="slideLabel(slide, group.slideIndexes[si])"
						@click="onSelect(group.slideIndexes[si])"
					>
						<span class="pptx-vue-section-thumb-num">{{ group.slideIndexes[si] + 1 }}</span>
						<span class="pptx-vue-section-stage" :style="stageWrapStyle">
							<SlideStage
								:slide="slide"
								:canvas-size="props.canvasSize"
								:media-data-urls="props.mediaDataUrls"
								:scale="tileScale"
							/>
						</span>
					</button>
				</li>
			</ul>

			<!-- Add-section affordance at the foot of each group. -->
			<button
				v-if="props.canEdit !== false && lastSlideIndex(group) >= 0"
				type="button"
				class="pptx-vue-section-add"
				:title="sectionCount === 0 ? 'Add section' : 'Add section here'"
				@click="emit('add-section', lastSlideIndex(group))"
			>
				+ Add section
			</button>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-section-list {
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 4px;
}

.pptx-vue-section-group {
	display: flex;
	flex-direction: column;
}

.pptx-vue-section-header {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 2px 4px;
}

.pptx-vue-section-toggle {
	display: inline-flex;
	flex: 1 1 auto;
	align-items: center;
	gap: 6px;
	min-width: 0;
	padding: 4px 6px;
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	background: transparent;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-section-toggle:hover {
	background: var(--pptx-vue-muted, #f3f4f6);
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-section-chevron {
	flex-shrink: 0;
	transition: transform 0.12s ease;
}

.pptx-vue-section-chevron.is-collapsed {
	transform: rotate(-90deg);
}

.pptx-vue-section-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pptx-vue-section-count {
	margin-left: auto;
	font-size: 10px;
	color: var(--pptx-vue-muted-foreground, #9ca3af);
}

.pptx-vue-section-rename {
	flex: 1 1 auto;
	min-width: 0;
	padding: 2px 4px;
	font-size: 11px;
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-popover, #fff);
	border: 1px solid var(--pptx-vue-focus, #2563eb);
	border-radius: 3px;
	outline: none;
}

.pptx-vue-section-actions {
	display: inline-flex;
	gap: 2px;
	opacity: 0;
	transition: opacity 0.12s ease;
}

.pptx-vue-section-header:hover .pptx-vue-section-actions {
	opacity: 1;
}

.pptx-vue-section-action {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 18px;
	padding: 0;
	font-size: 10px;
	line-height: 1;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	background: transparent;
	border: 1px solid transparent;
	border-radius: 3px;
	cursor: pointer;
}

.pptx-vue-section-action:hover {
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-section-action--danger:hover {
	color: var(--pptx-vue-danger, #c0392b);
}

.pptx-vue-section-slides {
	display: flex;
	flex-direction: column;
	gap: 6px;
	margin: 0;
	padding: 2px 4px 4px;
	list-style: none;
}

.pptx-vue-section-slide {
	display: flex;
}

.pptx-vue-section-thumb {
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
	padding: 2px;
	background: transparent;
	border: 1px solid transparent;
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-section-thumb:hover {
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-section-slide.is-active .pptx-vue-section-thumb {
	border-color: var(--pptx-vue-focus, #2563eb);
	background: var(--pptx-vue-muted, #eef2ff);
}

.pptx-vue-section-thumb-num {
	flex-shrink: 0;
	width: 18px;
	font-size: 10px;
	text-align: right;
	color: var(--pptx-vue-muted-foreground, #9ca3af);
}

.pptx-vue-section-stage {
	display: block;
	overflow: hidden;
	background: #fff;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 3px;
}

.pptx-vue-section-add {
	align-self: flex-start;
	margin: 0 4px 4px 28px;
	padding: 2px 6px;
	font-size: 10px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	background: transparent;
	border: 1px dashed var(--pptx-vue-border, #d1d5db);
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-section-add:hover {
	color: var(--pptx-vue-foreground, #111827);
	border-color: var(--pptx-vue-focus, #2563eb);
}
</style>
