<script setup lang="ts">
/**
 * SectionList - collapsible section headers grouping the slide thumbnails.
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
 * Presentational only: all state lives in the host. It receives the
 * `slidesBySection` grouping from `useSectionOperations` and emits the
 * operations back: `toggle-collapse`, `rename`, `move-up`, `move-down`,
 * `delete`, `add-section` (after a slide index), and `select` (a slide).
 */
import type { PptxSlide } from 'pptx-viewer-core';
import type { ComponentPublicInstance, CSSProperties } from 'vue';
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';

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

const { t } = useI18n();

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
	return t('pptx.notes.slideN', { n: slide.slideNumber || index + 1 });
}
</script>

<template>
	<div class="pptx-vue-section-list flex flex-col gap-0.5 p-1">
		<div
			v-for="(group, gi) in props.groups"
			:key="group.section?.id ?? `__nosection-${gi}`"
			class="pptx-vue-section-group flex flex-col"
		>
			<!-- Section header (omitted for the leading no-section group). -->
			<div
				v-if="group.section"
				class="pptx-vue-section-header group flex items-center gap-1 px-1 py-0.5"
			>
				<button
					type="button"
					class="pptx-vue-section-toggle inline-flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded border-none bg-transparent px-1.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
					:aria-expanded="!isCollapsed(group)"
					:title="
						isCollapsed(group) ? t('pptx.sectionList.expand') : t('pptx.sectionList.collapse')
					"
					@click="onHeaderClick(group)"
					@dblclick.stop="startRename(group.section.id, group.section.name)"
				>
					<svg
						class="pptx-vue-section-chevron h-3 w-3 flex-shrink-0 transition-transform"
						:class="{ 'is-collapsed -rotate-90': isCollapsed(group) }"
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
						class="pptx-vue-section-rename min-w-0 flex-1 rounded-sm border border-primary bg-popover px-1 py-0.5 text-[11px] text-foreground outline-none"
						type="text"
						@keydown="onRenameKeydown"
						@blur="commitRename"
						@click.stop
					/>
					<template v-else>
						<span class="pptx-vue-section-name overflow-hidden text-ellipsis whitespace-nowrap">{{
							group.section.name
						}}</span>
						<span class="pptx-vue-section-count ml-auto text-[10px] text-muted-foreground">{{
							group.slides.length
						}}</span>
					</template>
				</button>

				<div
					v-if="props.canEdit !== false && renamingId !== group.section.id"
					class="pptx-vue-section-actions inline-flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
				>
					<button
						type="button"
						class="pptx-vue-section-action inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent p-0 text-[10px] leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
						:title="t('pptx.sectionList.moveUp')"
						:aria-label="t('pptx.sectionList.moveUp')"
						@click="emit('move-up', group.section.id)"
					>
						▲
					</button>
					<button
						type="button"
						class="pptx-vue-section-action inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent p-0 text-[10px] leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
						:title="t('pptx.sectionList.moveDown')"
						:aria-label="t('pptx.sectionList.moveDown')"
						@click="emit('move-down', group.section.id)"
					>
						▼
					</button>
					<button
						type="button"
						class="pptx-vue-section-action pptx-vue-section-action--danger inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent p-0 text-[10px] leading-none text-muted-foreground hover:bg-muted hover:text-destructive"
						:title="t('pptx.sectionList.deleteSection')"
						:aria-label="t('pptx.sectionList.deleteSection')"
						@click="emit('delete', group.section.id)"
					>
						×
					</button>
				</div>
			</div>

			<!-- Slide thumbnails for this group (hidden while collapsed). -->
			<ul
				v-show="!isCollapsed(group)"
				class="pptx-vue-section-slides m-0 flex list-none flex-col gap-1.5 px-1 pb-1 pt-0.5"
			>
				<li
					v-for="(slide, si) in group.slides"
					:key="slide.id ?? group.slideIndexes[si]"
					class="pptx-vue-section-slide flex"
					:class="{ 'is-active': group.slideIndexes[si] === props.activeIndex }"
				>
					<button
						type="button"
						class="pptx-vue-section-thumb flex w-full cursor-pointer items-center gap-1.5 rounded border bg-transparent p-0.5"
						:class="
							group.slideIndexes[si] === props.activeIndex
								? 'border-primary bg-accent'
								: 'border-transparent hover:bg-muted'
						"
						:title="slideLabel(slide, group.slideIndexes[si])"
						:aria-label="slideLabel(slide, group.slideIndexes[si])"
						@click="onSelect(group.slideIndexes[si])"
					>
						<span
							class="pptx-vue-section-thumb-num w-[18px] flex-shrink-0 text-right text-[10px] text-muted-foreground"
							>{{ group.slideIndexes[si] + 1 }}</span
						>
						<span
							class="pptx-vue-section-stage block overflow-hidden rounded-sm border border-border bg-white"
							:style="stageWrapStyle"
						>
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
				class="pptx-vue-section-add mb-1 ml-7 mr-1 mt-0 cursor-pointer self-start rounded border border-dashed border-border bg-transparent px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-foreground"
				:title="
					sectionCount === 0
						? t('pptx.sectionList.addSection')
						: t('pptx.sectionList.addSectionHere')
				"
				@click="emit('add-section', lastSlideIndex(group))"
			>
				+ {{ t('pptx.sectionList.addSection') }}
			</button>
		</div>
	</div>
</template>
