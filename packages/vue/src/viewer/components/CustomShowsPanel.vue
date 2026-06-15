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
	<div class="pptx-vue-custom-shows">
		<header class="pptx-vue-cs-header">
			<h3 class="pptx-vue-cs-title">Custom shows</h3>
		</header>

		<!-- Show list + create -->
		<div class="pptx-vue-cs-list-row">
			<select
				class="pptx-vue-cs-select"
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
				class="pptx-vue-cs-btn"
				title="Rename show"
				@click="startRename"
			>
				Rename
			</button>
			<button
				v-if="activeShow"
				type="button"
				class="pptx-vue-cs-btn pptx-vue-cs-btn--danger"
				title="Delete show"
				@click="emit('delete', activeShow.id)"
			>
				Delete
			</button>
		</div>

		<div v-if="isRenaming" class="pptx-vue-cs-rename-row">
			<input
				v-model="renameDraft"
				class="pptx-vue-cs-input"
				type="text"
				aria-label="New show name"
				@keydown.enter.prevent="commitRename"
				@keydown.escape.prevent="isRenaming = false"
			/>
			<button type="button" class="pptx-vue-cs-btn" @click="commitRename">Save</button>
		</div>

		<form class="pptx-vue-cs-create-row" @submit.prevent="onCreate">
			<input
				v-model="newName"
				class="pptx-vue-cs-input"
				type="text"
				placeholder="New show name"
				aria-label="New custom show name"
			/>
			<button type="submit" class="pptx-vue-cs-btn">Create</button>
		</form>

		<!-- Membership checklist for the active show -->
		<div v-if="activeShow" class="pptx-vue-cs-members">
			<p class="pptx-vue-cs-section-label">Slides in show</p>
			<ol class="pptx-vue-cs-order">
				<li
					v-for="(slide, i) in orderedShowSlides"
					:key="slide.id ?? slide.rId"
					class="pptx-vue-cs-order-item"
				>
					<span class="pptx-vue-cs-order-label">{{ slideLabel(slide, i) }}</span>
					<button
						type="button"
						class="pptx-vue-cs-mini"
						title="Move up"
						aria-label="Move up"
						:disabled="i === 0"
						@click="emit('move-slide', activeShow.id, i, i - 1)"
					>
						▲
					</button>
					<button
						type="button"
						class="pptx-vue-cs-mini"
						title="Move down"
						aria-label="Move down"
						:disabled="i === orderedShowSlides.length - 1"
						@click="emit('move-slide', activeShow.id, i, i + 1)"
					>
						▼
					</button>
				</li>
				<li v-if="orderedShowSlides.length === 0" class="pptx-vue-cs-empty">
					No slides yet — add them below.
				</li>
			</ol>

			<p class="pptx-vue-cs-section-label">All slides</p>
			<ul class="pptx-vue-cs-all">
				<li v-for="(slide, i) in props.slides" :key="slide.id ?? i" class="pptx-vue-cs-all-item">
					<label class="pptx-vue-cs-check">
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

<style scoped>
.pptx-vue-custom-shows {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 10px;
	font-size: 12px;
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-cs-header {
	display: flex;
	align-items: center;
}

.pptx-vue-cs-title {
	margin: 0;
	font-size: 13px;
	font-weight: 600;
}

.pptx-vue-cs-list-row,
.pptx-vue-cs-rename-row,
.pptx-vue-cs-create-row {
	display: flex;
	align-items: center;
	gap: 6px;
}

.pptx-vue-cs-select,
.pptx-vue-cs-input {
	flex: 1 1 auto;
	min-width: 0;
	padding: 4px 6px;
	font-size: 12px;
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-popover, #fff);
	border: 1px solid var(--pptx-vue-border, #d1d5db);
	border-radius: 4px;
}

.pptx-vue-cs-btn {
	flex-shrink: 0;
	padding: 4px 8px;
	font-size: 12px;
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-muted, #f3f4f6);
	border: 1px solid var(--pptx-vue-border, #d1d5db);
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-cs-btn:hover {
	background: var(--pptx-vue-muted, #e5e7eb);
}

.pptx-vue-cs-btn--danger:hover {
	color: var(--pptx-vue-danger, #c0392b);
	border-color: var(--pptx-vue-danger, #c0392b);
}

.pptx-vue-cs-members {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.pptx-vue-cs-section-label {
	margin: 6px 0 2px;
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-cs-order,
.pptx-vue-cs-all {
	display: flex;
	flex-direction: column;
	gap: 2px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.pptx-vue-cs-order-item {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 2px 4px;
	border-radius: 3px;
}

.pptx-vue-cs-order-label {
	flex: 1 1 auto;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pptx-vue-cs-mini {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 18px;
	padding: 0;
	font-size: 9px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	background: transparent;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 3px;
	cursor: pointer;
}

.pptx-vue-cs-mini:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.pptx-vue-cs-mini:hover:not(:disabled) {
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-cs-empty {
	padding: 2px 4px;
	color: var(--pptx-vue-muted-foreground, #9ca3af);
	font-style: italic;
}

.pptx-vue-cs-check {
	display: flex;
	align-items: center;
	gap: 6px;
	cursor: pointer;
}

.pptx-vue-cs-all-item {
	padding: 1px 4px;
}
</style>
