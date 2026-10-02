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
 *  - a right-click (or context-menu key) section menu: Rename, Delete, Move Up,
 *    Move Down and Add Section After, from the shared
 *    buildSectionContextMenuEntries (replaces the old hover buttons),
 *  - the same thumbnail right-click menu and Ctrl/Shift multi-select as the
 *    flat rail (useSlidePaneRailMenu).
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

import { useSectionContextMenu } from '../composables/useSectionContextMenu';
import type { SectionGroup } from '../composables/useSectionOperations';
import { useSlidePaneRailMenu } from '../composables/useSlidePaneRailMenu';
import type { CanvasSize } from '../types';
import ContextMenu from './ContextMenu.vue';
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
	/** Delete a section (named apart from the thumbnail menu's slide `delete`). */
	'delete-section': [sectionId: string];
	/** Add a new section at the given slide index. */
	'add-section': [slideIndex: number];
	'add-slide-after': [index: number];
	duplicate: [indexes: number[]];
	delete: [indexes: number[]];
	'toggle-hidden': [indexes: number[]];
	layout: [payload: { index: number; x: number; y: number }];
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

/** Every slide in deck order, so the thumbnail menu's indexes are deck indexes. */
const deckSlides = computed<PptxSlide[]>(() => {
	const ordered: PptxSlide[] = [];
	for (const group of props.groups) {
		group.slides.forEach((slide, offset) => {
			ordered[group.slideIndexes[offset]] = slide;
		});
	}
	return ordered;
});

const {
	isSelected,
	onSlideClick,
	onPaneKeydown,
	menu: slideMenu,
	menuItems: slideMenuItems,
	onContextMenu: onSlideContextMenu,
	onMenuSelect: onSlideMenuSelect,
} = useSlidePaneRailMenu(
	() => deckSlides.value,
	() => props.activeIndex,
	() => props.canEdit !== false,
	// This list emits more events than the rail menu uses, so the strict
	// per-event overload of the composable cannot take `emit` directly.
	(event, ...args) => (emit as (name: string, ...rest: unknown[]) => void)(event, ...args),
);

const {
	menu: sectionMenu,
	items: sectionMenuItems,
	openFor: openSectionMenu,
	onSelect: onSectionMenuSelect,
} = useSectionContextMenu(
	() => props.groups,
	() => deckSlides.value.length,
	() => props.canEdit !== false,
	{
		rename: (sectionId, name) => void startRename(sectionId, name),
		moveUp: (sectionId) => emit('move-up', sectionId),
		moveDown: (sectionId) => emit('move-down', sectionId),
		remove: (sectionId) => emit('delete-section', sectionId),
		addAfter: (slideIndex) => emit('add-section', slideIndex),
	},
);

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

function slideLabel(slide: PptxSlide, index: number): string {
	return t('pptx.notes.slideN', { n: slide.slideNumber || index + 1 });
}
</script>

<template>
	<div class="pptx-vue-section-list flex flex-col gap-0.5 p-1" @keydown="onPaneKeydown">
		<div
			v-for="(group, gi) in props.groups"
			:key="group.section?.id ?? `__nosection-${gi}`"
			class="pptx-vue-section-group flex flex-col"
		>
			<!-- Section header (omitted for the leading no-section group). -->
			<div
				v-if="group.section"
				class="pptx-vue-section-header group flex items-center gap-1 px-1 py-0.5"
				data-pptx-chrome="section-header"
			>
				<button
					type="button"
					class="pptx-vue-section-toggle inline-flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded border-none bg-transparent px-1.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-foreground"
					:aria-expanded="!isCollapsed(group)"
					:title="
						isCollapsed(group) ? t('pptx.sectionList.expand') : t('pptx.sectionList.collapse')
					"
					@click="onHeaderClick(group)"
					@contextmenu="openSectionMenu($event, group.section.id)"
					@dblclick.stop="startRename(group.section.id, group.section.name)"
				>
					<!-- Section colour from `p15:sectionPr/@clr`. Core parses and
					     round-trips it and React's sorter paints it; the Vue rail
					     dropped it on the floor, so a colour-coded deck looked
					     uncoloured here. -->
					<span
						v-if="group.section.color"
						class="pptx-vue-section-color inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
						:style="{ backgroundColor: group.section.color }"
						data-pptx-section-color
						aria-hidden="true"
					/>
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
								: isSelected(slide.id)
									? 'border-primary/50 bg-accent/30'
									: 'border-transparent hover:bg-muted'
						"
						:title="slideLabel(slide, group.slideIndexes[si])"
						:aria-label="t('pptx.slidesPanel.goToSlide', { n: group.slideIndexes[si] + 1 })"
						@click="onSlideClick($event, group.slideIndexes[si])"
						@contextmenu="onSlideContextMenu($event, group.slideIndexes[si])"
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
		</div>

		<ContextMenu
			:open="sectionMenu.open"
			:x="sectionMenu.x"
			:y="sectionMenu.y"
			:items="sectionMenuItems"
			:aria-label="t('pptx.sections.sectionButtonLabel')"
			@select="onSectionMenuSelect"
			@close="sectionMenu.open = false"
		/>
		<ContextMenu
			:open="slideMenu.open"
			:x="slideMenu.x"
			:y="slideMenu.y"
			:items="slideMenuItems"
			@select="onSlideMenuSelect"
			@close="slideMenu.open = false"
		/>
	</div>
</template>
