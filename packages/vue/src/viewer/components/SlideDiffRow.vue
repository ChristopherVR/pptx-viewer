<script setup lang="ts">
import { Check, ChevronDown, ChevronRight, Minus, Move, Plus, Type, X } from 'lucide-vue-next';
import type { Component } from 'vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ElementChange, SlideDiff } from '../composables/slide-compare';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * SlideDiffRow - a single expandable slide-diff entry.
 *
 * Vue port of the React `SlideDiffRow.tsx`. Shows the slide's status badge,
 * change count, and (when expanded) side-by-side base/incoming thumbnails plus
 * the per-element change list and accept/reject actions. Unchanged diffs render
 * nothing (the parent filters them, but we guard here too).
 */
const props = defineProps<{
	diff: SlideDiff;
	diffIndex: number;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	accepted: boolean;
	rejected: boolean;
}>();

const emit = defineEmits<{
	(e: 'accept' | 'reject', index: number): void;
}>();

const { t } = useI18n();

const expanded = ref(props.diff.status === 'changed');

const isResolved = computed(() => props.accepted || props.rejected);

const slideNumber = computed(() =>
	props.diff.baseIndex >= 0 ? props.diff.baseIndex + 1 : props.diff.compareIndex + 1,
);

const statusLabel = computed(() => {
	switch (props.diff.status) {
		case 'added':
			return t('pptx.compare.statusAdded');
		case 'removed':
			return t('pptx.compare.statusRemoved');
		case 'changed':
			return t('pptx.compare.statusChanged');
		default:
			return t('pptx.compare.statusUnchanged');
	}
});

/** CSS modifier class for the status badge / incoming thumbnail border. */
const statusClass = computed(() => `pptx-vue-diff-status--${props.diff.status}`);

/** Tailwind classes for the status badge pill (matches React `statusColor`). */
const statusBadgeClass = computed(() => {
	switch (props.diff.status) {
		case 'added':
			return 'text-green-400 bg-green-900/30';
		case 'removed':
			return 'text-red-400 bg-red-900/30';
		case 'changed':
			return 'text-amber-400 bg-amber-900/30';
		default:
			return 'text-muted-foreground bg-muted/30';
	}
});

/** Tailwind border class for the incoming thumbnail wrapper. */
const incomingThumbBorderClass = computed(() => {
	switch (props.diff.status) {
		case 'added':
			return 'border-green-700/60';
		case 'changed':
			return 'border-amber-700/60';
		default:
			return 'border-border';
	}
});

/** Tailwind color for a change-kind symbol. */
function changeKindColor(kind: ElementChange['kind']): string {
	switch (kind) {
		case 'added':
			return 'text-green-400';
		case 'removed':
			return 'text-red-400';
		case 'moved':
			return 'text-primary';
		case 'resized':
			return 'text-amber-400';
		case 'textChanged':
			return 'text-purple-400';
	}
}

// Thumbnail preview scale: fit the canvas width into a compact column.
const THUMB_WIDTH = 180;
const thumbScale = computed(() =>
	props.canvasSize.width > 0 ? THUMB_WIDTH / props.canvasSize.width : 1,
);
const thumbStyle = computed(() => ({
	width: `${THUMB_WIDTH}px`,
	height: `${props.canvasSize.height * thumbScale.value}px`,
}));

/** Lucide icon per change kind; mirrors React's `ChangeKindIcon`. */
function changeKindIcon(kind: ElementChange['kind']): Component {
	switch (kind) {
		case 'added':
			return Plus;
		case 'removed':
			return Minus;
		case 'moved':
		case 'resized':
			return Move;
		case 'textChanged':
			return Type;
	}
}

function toggle(): void {
	expanded.value = !expanded.value;
}
</script>

<template>
	<div
		v-if="diff.status !== 'unchanged'"
		class="pptx-vue-diff-row rounded-lg border transition-colors"
		:class="
			isResolved
				? ['pptx-vue-diff-row--resolved', 'border-border/60 bg-card/40 opacity-60']
				: 'border-border bg-background/70'
		"
	>
		<button
			type="button"
			class="pptx-vue-diff-header flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-xs text-foreground"
			@click="toggle"
		>
			<component
				:is="expanded ? ChevronDown : ChevronRight"
				class="pptx-vue-diff-caret h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
				aria-hidden="true"
			/>
			<span class="pptx-vue-diff-slide-no">{{
				t('pptx.compare.slideNumber', { number: slideNumber })
			}}</span>
			<span
				class="pptx-vue-diff-status rounded-full px-2 py-0.5 text-[10px] font-medium"
				:class="[statusClass, statusBadgeClass]"
				>{{ statusLabel }}</span
			>
			<span
				v-if="diff.changes.length > 0"
				class="pptx-vue-diff-count text-[10px] text-muted-foreground"
			>
				{{ diff.changes.length }} {{ diff.changes.length === 1 ? 'change' : 'changes' }}
			</span>
			<span class="pptx-vue-diff-spacer flex-1" />
			<span
				v-if="isResolved"
				class="pptx-vue-diff-resolution text-[10px] font-medium"
				:class="
					accepted
						? ['pptx-vue-diff-resolution--accepted', 'text-green-400']
						: ['pptx-vue-diff-resolution--rejected', 'text-muted-foreground']
				"
			>
				{{ accepted ? t('pptx.compare.accepted') : t('pptx.compare.rejected') }}
			</span>
		</button>

		<div v-if="expanded" class="pptx-vue-diff-body flex flex-col gap-2 px-3 pb-3">
			<div class="pptx-vue-diff-thumbs flex gap-2">
				<div v-if="diff.baseSlide" class="pptx-vue-diff-thumb-col flex-1">
					<div class="pptx-vue-diff-thumb-label mb-1 text-[10px] text-muted-foreground">
						{{ t('pptx.compare.current') }}
					</div>
					<div
						class="pptx-vue-diff-thumb overflow-hidden rounded border border-border"
						:style="thumbStyle"
					>
						<SlideStage
							:slide="diff.baseSlide"
							:canvas-size="canvasSize"
							:media-data-urls="mediaDataUrls"
							:scale="thumbScale"
						/>
					</div>
				</div>
				<div v-if="diff.compareSlide" class="pptx-vue-diff-thumb-col flex-1">
					<div class="pptx-vue-diff-thumb-label mb-1 text-[10px] text-muted-foreground">
						{{ t('pptx.compare.incoming') }}
					</div>
					<div
						class="pptx-vue-diff-thumb overflow-hidden rounded border"
						:class="[statusClass, incomingThumbBorderClass]"
						:style="thumbStyle"
					>
						<SlideStage
							:slide="diff.compareSlide"
							:canvas-size="canvasSize"
							:media-data-urls="mediaDataUrls"
							:scale="thumbScale"
						/>
					</div>
				</div>
			</div>

			<ul
				v-if="diff.changes.length > 0"
				class="pptx-vue-diff-changes m-0 flex list-none flex-col gap-1 p-0"
			>
				<li
					v-for="(change, ci) in diff.changes"
					:key="`${change.elementId}-${change.kind}-${ci}`"
					class="pptx-vue-diff-change flex items-start gap-2 rounded bg-muted/60 px-2 py-1.5 text-[11px]"
				>
					<component
						:is="changeKindIcon(change.kind)"
						class="pptx-vue-diff-change-kind h-3 w-3 flex-shrink-0"
						:class="[`pptx-vue-diff-change-kind--${change.kind}`, changeKindColor(change.kind)]"
						aria-hidden="true"
					/>
					<span class="pptx-vue-diff-change-desc text-foreground">{{ change.description }}</span>
				</li>
			</ul>

			<div v-if="!isResolved" class="pptx-vue-diff-actions flex items-center gap-2 pt-1">
				<button
					type="button"
					class="pptx-vue-diff-btn pptx-vue-diff-btn--accept inline-flex cursor-pointer items-center gap-1 rounded bg-green-700/80 px-2.5 py-1 text-[11px] text-green-50 transition-colors hover:bg-green-600"
					@click="emit('accept', diffIndex)"
				>
					<Check class="h-3 w-3" aria-hidden="true" />
					{{ t('pptx.compare.accept') }}
				</button>
				<button
					type="button"
					class="pptx-vue-diff-btn pptx-vue-diff-btn--reject inline-flex cursor-pointer items-center gap-1 rounded bg-accent px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/80"
					@click="emit('reject', diffIndex)"
				>
					<X class="h-3 w-3" aria-hidden="true" />
					{{ t('pptx.compare.reject') }}
				</button>
			</div>
		</div>
	</div>
</template>
