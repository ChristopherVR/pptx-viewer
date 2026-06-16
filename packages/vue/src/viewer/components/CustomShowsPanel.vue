<script setup lang="ts">
/**
 * CustomShowsPanel — list / create / rename / delete custom slide shows and
 * edit the ordered slide list of the selected show.
 *
 * Vue counterpart of the React custom-show controls (`CustomShowsControls.tsx`
 * + `useDialogCustomShows`). The selected show's membership is edited by
 * toggling each slide's checkbox; ordering uses up/down arrows. Naming uses a
 * tiny inline form (the React version used `window.prompt`).
 *
 * Presentational only — all state lives in the host, which wires the emits to
 * `useCustomShows`. Emits: `create`, `rename`, `delete`, `select`,
 * `toggle-slide`, `move-slide`.
 */
import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { computed, ref } from 'vue';

const props = defineProps<{
	/** All custom shows. */
	customShows: PptxCustomShow[];
	/** All slides, used to render the membership checklist. */
	slides: PptxSlide[];
	/** Id of the currently selected show, or `null`. */
	activeShowId: string | null;
}>();

const emit = defineEmits<{
	/** Create a show with the given name. */
	create: [name: string];
	/** Rename a show. */
	rename: [showId: string, name: string];
	/** Delete a show. */
	delete: [showId: string];
	/** Select a show as active. */
	select: [showId: string];
	/** Toggle a slide (by relationship id) in a show. */
	'toggle-slide': [showId: string, slideRId: string];
	/** Move a slide within a show's order. */
	'move-slide': [showId: string, from: number, to: number];
}>();

const newName = ref('');
const renameDraft = ref('');
const isRenaming = ref(false);

const activeShow = computed<PptxCustomShow | undefined>(() =>
	props.customShows.find((s) => s.id === props.activeShowId),
);

/** Slides ordered as they appear in the active show. */
const orderedShowSlides = computed<PptxSlide[]>(() => {
	const show = activeShow.value;
	if (!show) {
		return [];
	}
	const byRId = new Map<string, PptxSlide>();
	for (const slide of props.slides) {
		if (slide.rId) {
			byRId.set(slide.rId, slide);
		}
	}
	return show.slideRIds.map((rId) => byRId.get(rId)).filter((s): s is PptxSlide => s !== undefined);
});

function slideRIdSet(): Set<string> {
	return new Set(activeShow.value?.slideRIds ?? []);
}

function isSlideInShow(slide: PptxSlide): boolean {
	return slide.rId ? slideRIdSet().has(slide.rId) : false;
}

function slideLabel(slide: PptxSlide, index: number): string {
	return slide.name?.trim() || `Slide ${slide.slideNumber || index + 1}`;
}

function onCreate(): void {
	emit('create', newName.value);
	newName.value = '';
}

function startRename(): void {
	if (!activeShow.value) {
		return;
	}
	renameDraft.value = activeShow.value.name;
	isRenaming.value = true;
}

function commitRename(): void {
	const show = activeShow.value;
	if (show && renameDraft.value.trim().length > 0) {
		emit('rename', show.id, renameDraft.value);
	}
	isRenaming.value = false;
}

function onToggleSlide(slide: PptxSlide): void {
	if (activeShow.value && slide.rId) {
		emit('toggle-slide', activeShow.value.id, slide.rId);
	}
}
</script>

<template>
	<div class="pptx-vue-custom-shows flex flex-col gap-2 p-2.5 text-xs text-foreground">
		<header class="pptx-vue-cs-header flex items-center">
			<h3 class="pptx-vue-cs-title m-0 text-[13px] font-semibold">Custom shows</h3>
		</header>

		<!-- Show list + create -->
		<div class="pptx-vue-cs-list-row flex items-center gap-1.5">
			<select
				class="pptx-vue-cs-select min-w-0 flex-1 rounded border border-border bg-popover px-1.5 py-1 text-xs text-foreground"
				aria-label="Custom show"
				:value="props.activeShowId ?? ''"
				@change="emit('select', ($event.target as HTMLSelectElement).value)"
			>
				<option v-if="props.customShows.length === 0" value="" disabled>No custom shows</option>
				<option v-for="show in props.customShows" :key="show.id" :value="show.id">
					{{ show.name }} ({{ show.slideRIds.length }})
				</option>
			</select>

			<button
				v-if="activeShow"
				type="button"
				class="pptx-vue-cs-btn shrink-0 cursor-pointer rounded border border-border bg-muted px-2 py-1 text-xs text-foreground hover:bg-accent"
				title="Rename show"
				@click="startRename"
			>
				Rename
			</button>
			<button
				v-if="activeShow"
				type="button"
				class="pptx-vue-cs-btn pptx-vue-cs-btn--danger shrink-0 cursor-pointer rounded border border-border bg-muted px-2 py-1 text-xs text-foreground hover:border-destructive hover:text-destructive"
				title="Delete show"
				@click="emit('delete', activeShow.id)"
			>
				Delete
			</button>
		</div>

		<div v-if="isRenaming" class="pptx-vue-cs-rename-row flex items-center gap-1.5">
			<input
				v-model="renameDraft"
				class="pptx-vue-cs-input min-w-0 flex-1 rounded border border-border bg-popover px-1.5 py-1 text-xs text-foreground"
				type="text"
				aria-label="New show name"
				@keydown.enter.prevent="commitRename"
				@keydown.escape.prevent="isRenaming = false"
			/>
			<button
				type="button"
				class="pptx-vue-cs-btn shrink-0 cursor-pointer rounded border border-border bg-muted px-2 py-1 text-xs text-foreground hover:bg-accent"
				@click="commitRename"
			>
				Save
			</button>
		</div>

		<form class="pptx-vue-cs-create-row flex items-center gap-1.5" @submit.prevent="onCreate">
			<input
				v-model="newName"
				class="pptx-vue-cs-input min-w-0 flex-1 rounded border border-border bg-popover px-1.5 py-1 text-xs text-foreground"
				type="text"
				placeholder="New show name"
				aria-label="New custom show name"
			/>
			<button
				type="submit"
				class="pptx-vue-cs-btn shrink-0 cursor-pointer rounded border border-border bg-muted px-2 py-1 text-xs text-foreground hover:bg-accent"
			>
				Create
			</button>
		</form>

		<!-- Membership checklist for the active show -->
		<div v-if="activeShow" class="pptx-vue-cs-members flex flex-col gap-1">
			<p
				class="pptx-vue-cs-section-label mt-1.5 mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
			>
				Slides in show
			</p>
			<ol class="pptx-vue-cs-order m-0 flex list-none flex-col gap-0.5 p-0">
				<li
					v-for="(slide, i) in orderedShowSlides"
					:key="slide.id ?? slide.rId"
					class="pptx-vue-cs-order-item flex items-center gap-1 rounded-sm px-1 py-0.5"
				>
					<span
						class="pptx-vue-cs-order-label flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
						>{{ slideLabel(slide, i) }}</span
					>
					<button
						type="button"
						class="pptx-vue-cs-mini inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-sm border border-border bg-transparent p-0 text-[9px] text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
						title="Move up"
						aria-label="Move up"
						:disabled="i === 0"
						@click="emit('move-slide', activeShow.id, i, i - 1)"
					>
						▲
					</button>
					<button
						type="button"
						class="pptx-vue-cs-mini inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-sm border border-border bg-transparent p-0 text-[9px] text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
						title="Move down"
						aria-label="Move down"
						:disabled="i === orderedShowSlides.length - 1"
						@click="emit('move-slide', activeShow.id, i, i + 1)"
					>
						▼
					</button>
				</li>
				<li
					v-if="orderedShowSlides.length === 0"
					class="pptx-vue-cs-empty px-1 py-0.5 italic text-muted-foreground"
				>
					No slides yet — add them below.
				</li>
			</ol>

			<p
				class="pptx-vue-cs-section-label mt-1.5 mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
			>
				All slides
			</p>
			<ul class="pptx-vue-cs-all m-0 flex list-none flex-col gap-0.5 p-0">
				<li
					v-for="(slide, i) in props.slides"
					:key="slide.id ?? i"
					class="pptx-vue-cs-all-item px-1 py-px"
				>
					<label class="pptx-vue-cs-check flex cursor-pointer items-center gap-1.5">
						<input
							type="checkbox"
							:checked="isSlideInShow(slide)"
							:disabled="!slide.rId"
							@change="onToggleSlide(slide)"
						/>
						<span>{{ slideLabel(slide, i) }}</span>
					</label>
				</li>
			</ul>
		</div>
	</div>
</template>
