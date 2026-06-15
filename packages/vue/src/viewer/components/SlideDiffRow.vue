<script setup lang="ts">
import { computed, ref } from 'vue';

import type { ElementChange, SlideDiff } from '../composables/slide-compare';
import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

/**
 * SlideDiffRow — a single expandable slide-diff entry.
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
	(e: 'accept', index: number): void;
	(e: 'reject', index: number): void;
}>();

const expanded = ref(props.diff.status === 'changed');

const isResolved = computed(() => props.accepted || props.rejected);

const slideNumber = computed(() =>
	props.diff.baseIndex >= 0 ? props.diff.baseIndex + 1 : props.diff.compareIndex + 1,
);

const statusLabel = computed(() => {
	switch (props.diff.status) {
		case 'added':
			return 'Added';
		case 'removed':
			return 'Removed';
		case 'changed':
			return 'Changed';
		default:
			return 'Unchanged';
	}
});

/** CSS modifier class for the status badge / incoming thumbnail border. */
const statusClass = computed(() => `pptx-vue-diff-status--${props.diff.status}`);

// Thumbnail preview scale: fit the canvas width into a compact column.
const THUMB_WIDTH = 180;
const thumbScale = computed(() =>
	props.canvasSize.width > 0 ? THUMB_WIDTH / props.canvasSize.width : 1,
);
const thumbStyle = computed(() => ({
	width: `${THUMB_WIDTH}px`,
	height: `${props.canvasSize.height * thumbScale.value}px`,
}));

function changeKindSymbol(kind: ElementChange['kind']): string {
	switch (kind) {
		case 'added':
			return '+';
		case 'removed':
			return '−';
		case 'moved':
			return '↔';
		case 'resized':
			return '⤢';
		case 'textChanged':
			return 'T';
	}
}

function toggle(): void {
	expanded.value = !expanded.value;
}
</script>

<template>
	<div
		v-if="diff.status !== 'unchanged'"
		class="pptx-vue-diff-row"
		:class="{ 'pptx-vue-diff-row--resolved': isResolved }"
	>
		<button type="button" class="pptx-vue-diff-header" @click="toggle">
			<span class="pptx-vue-diff-caret">{{ expanded ? '▾' : '▸' }}</span>
			<span class="pptx-vue-diff-slide-no">Slide {{ slideNumber }}</span>
			<span class="pptx-vue-diff-status" :class="statusClass">{{ statusLabel }}</span>
			<span v-if="diff.changes.length > 0" class="pptx-vue-diff-count">
				{{ diff.changes.length }} {{ diff.changes.length === 1 ? 'change' : 'changes' }}
			</span>
			<span class="pptx-vue-diff-spacer" />
			<span
				v-if="isResolved"
				class="pptx-vue-diff-resolution"
				:class="
					accepted ? 'pptx-vue-diff-resolution--accepted' : 'pptx-vue-diff-resolution--rejected'
				"
			>
				{{ accepted ? 'Accepted' : 'Rejected' }}
			</span>
		</button>

		<div v-if="expanded" class="pptx-vue-diff-body">
			<div class="pptx-vue-diff-thumbs">
				<div v-if="diff.baseSlide" class="pptx-vue-diff-thumb-col">
					<div class="pptx-vue-diff-thumb-label">Current</div>
					<div class="pptx-vue-diff-thumb" :style="thumbStyle">
						<SlideStage
							:slide="diff.baseSlide"
							:canvas-size="canvasSize"
							:media-data-urls="mediaDataUrls"
							:scale="thumbScale"
						/>
					</div>
				</div>
				<div v-if="diff.compareSlide" class="pptx-vue-diff-thumb-col">
					<div class="pptx-vue-diff-thumb-label">Incoming</div>
					<div class="pptx-vue-diff-thumb" :class="statusClass" :style="thumbStyle">
						<SlideStage
							:slide="diff.compareSlide"
							:canvas-size="canvasSize"
							:media-data-urls="mediaDataUrls"
							:scale="thumbScale"
						/>
					</div>
				</div>
			</div>

			<ul v-if="diff.changes.length > 0" class="pptx-vue-diff-changes">
				<li
					v-for="(change, ci) in diff.changes"
					:key="`${change.elementId}-${change.kind}-${ci}`"
					class="pptx-vue-diff-change"
				>
					<span
						class="pptx-vue-diff-change-kind"
						:class="`pptx-vue-diff-change-kind--${change.kind}`"
					>
						{{ changeKindSymbol(change.kind) }}
					</span>
					<span class="pptx-vue-diff-change-desc">{{ change.description }}</span>
				</li>
			</ul>

			<div v-if="!isResolved" class="pptx-vue-diff-actions">
				<button
					type="button"
					class="pptx-vue-diff-btn pptx-vue-diff-btn--accept"
					@click="emit('accept', diffIndex)"
				>
					Accept
				</button>
				<button
					type="button"
					class="pptx-vue-diff-btn pptx-vue-diff-btn--reject"
					@click="emit('reject', diffIndex)"
				>
					Reject
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-diff-row {
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 8px;
	background: var(--pptx-vue-background, #ffffff);
	transition: opacity 0.15s ease;
}

.pptx-vue-diff-row--resolved {
	opacity: 0.6;
}

.pptx-vue-diff-header {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 8px 12px;
	text-align: left;
	background: transparent;
	border: none;
	cursor: pointer;
	font-size: 12px;
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-diff-caret {
	flex-shrink: 0;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-diff-spacer {
	flex: 1;
}

.pptx-vue-diff-status {
	padding: 1px 8px;
	border-radius: 999px;
	font-size: 10px;
	font-weight: 600;
}

.pptx-vue-diff-status--added {
	color: #15803d;
	background: rgba(34, 197, 94, 0.18);
}

.pptx-vue-diff-status--removed {
	color: #b91c1c;
	background: rgba(239, 68, 68, 0.18);
}

.pptx-vue-diff-status--changed {
	color: #b45309;
	background: rgba(245, 158, 11, 0.18);
}

.pptx-vue-diff-count {
	font-size: 10px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-diff-resolution {
	font-size: 10px;
	font-weight: 600;
}

.pptx-vue-diff-resolution--accepted {
	color: #15803d;
}

.pptx-vue-diff-resolution--rejected {
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-diff-body {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 0 12px 12px;
}

.pptx-vue-diff-thumbs {
	display: flex;
	gap: 8px;
}

.pptx-vue-diff-thumb-col {
	flex: 1;
}

.pptx-vue-diff-thumb-label {
	margin-bottom: 4px;
	font-size: 10px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-diff-thumb {
	overflow: hidden;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
}

.pptx-vue-diff-thumb.pptx-vue-diff-status--added {
	border-color: rgba(34, 197, 94, 0.6);
}

.pptx-vue-diff-thumb.pptx-vue-diff-status--changed {
	border-color: rgba(245, 158, 11, 0.6);
}

.pptx-vue-diff-changes {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.pptx-vue-diff-change {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	padding: 6px 8px;
	border-radius: 4px;
	background: var(--pptx-vue-muted, #f3f4f6);
	font-size: 11px;
}

.pptx-vue-diff-change-kind {
	flex-shrink: 0;
	width: 14px;
	text-align: center;
	font-weight: 700;
}

.pptx-vue-diff-change-kind--added {
	color: #15803d;
}

.pptx-vue-diff-change-kind--removed {
	color: #b91c1c;
}

.pptx-vue-diff-change-kind--moved {
	color: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-diff-change-kind--resized {
	color: #b45309;
}

.pptx-vue-diff-change-kind--textChanged {
	color: #7c3aed;
}

.pptx-vue-diff-actions {
	display: flex;
	gap: 8px;
	padding-top: 2px;
}

.pptx-vue-diff-btn {
	display: inline-flex;
	align-items: center;
	padding: 4px 12px;
	border: none;
	border-radius: 4px;
	font-size: 11px;
	cursor: pointer;
}

.pptx-vue-diff-btn--accept {
	color: #f0fdf4;
	background: #15803d;
}

.pptx-vue-diff-btn--reject {
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-muted, #f3f4f6);
}
</style>
