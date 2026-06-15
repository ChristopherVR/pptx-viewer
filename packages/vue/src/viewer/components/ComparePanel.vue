<script setup lang="ts">
import { computed, ref } from 'vue';

import type { CompareResult } from '../composables/slide-compare';
import type { CanvasSize } from '../types';
import SlideDiffRow from './SlideDiffRow.vue';

/**
 * ComparePanel — side panel showing slide-level diffs between two versions.
 *
 * Vue port of the React `ComparePanel.tsx`. Lists each non-trivial
 * {@link SlideDiff} as a {@link SlideDiffRow}; the user can accept/reject
 * individual diffs or accept all at once. Accepted/rejected state is tracked
 * locally and propagated to the host via emits, which carry the diff index.
 */
const props = defineProps<{
	/** Whether the panel is visible. */
	open: boolean;
	/** The comparison result, or `null` when nothing to compare. */
	compareResult: CompareResult | null;
	/** Canvas dimensions used to render diff thumbnails. */
	canvasSize: CanvasSize;
	/** Resolved media data URLs for thumbnail rendering. */
	mediaDataUrls: Map<string, string>;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'accept-slide', diffIndex: number): void;
	(e: 'reject-slide', diffIndex: number): void;
	(e: 'accept-all'): void;
}>();

const accepted = ref<Record<number, boolean>>({});
const rejected = ref<Record<number, boolean>>({});

const nonTrivialCount = computed(
	() => props.compareResult?.diffs.filter((d) => d.status !== 'unchanged').length ?? 0,
);

function handleAccept(index: number): void {
	accepted.value = { ...accepted.value, [index]: true };
	const next = { ...rejected.value };
	delete next[index];
	rejected.value = next;
	emit('accept-slide', index);
}

function handleReject(index: number): void {
	rejected.value = { ...rejected.value, [index]: true };
	const next = { ...accepted.value };
	delete next[index];
	accepted.value = next;
	emit('reject-slide', index);
}

function handleAcceptAll(): void {
	if (!props.compareResult) {
		return;
	}
	const acc: Record<number, boolean> = {};
	props.compareResult.diffs.forEach((d, i) => {
		if (d.status !== 'unchanged') {
			acc[i] = true;
		}
	});
	accepted.value = acc;
	rejected.value = {};
	emit('accept-all');
}
</script>

<template>
	<aside v-if="open && compareResult" class="pptx-vue-compare-panel">
		<header class="pptx-vue-compare-header">
			<div>
				<h3 class="pptx-vue-compare-title">Compare versions</h3>
				<p class="pptx-vue-compare-summary">
					{{ compareResult.addedCount }} added · {{ compareResult.removedCount }} removed ·
					{{ compareResult.changedCount }} changed
				</p>
			</div>
			<button
				type="button"
				class="pptx-vue-compare-close"
				aria-label="Close"
				@click="emit('close')"
			>
				&times;
			</button>
		</header>

		<div v-if="nonTrivialCount > 0" class="pptx-vue-compare-actions">
			<button type="button" class="pptx-vue-compare-accept-all" @click="handleAcceptAll">
				Accept all
			</button>
		</div>

		<div class="pptx-vue-compare-list">
			<p v-if="nonTrivialCount === 0" class="pptx-vue-compare-empty">No differences</p>
			<template v-else>
				<SlideDiffRow
					v-for="(diff, i) in compareResult.diffs"
					:key="`diff-${i}-${diff.status}`"
					:diff="diff"
					:diff-index="i"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:accepted="Boolean(accepted[i])"
					:rejected="Boolean(rejected[i])"
					@accept="handleAccept"
					@reject="handleReject"
				/>
			</template>
		</div>
	</aside>
</template>

<style scoped>
.pptx-vue-compare-panel {
	position: fixed;
	top: 0;
	bottom: 0;
	right: 0;
	z-index: 50;
	display: flex;
	flex-direction: column;
	width: 440px;
	max-width: 100vw;
	background: var(--pptx-vue-popover, #ffffff);
	color: var(--pptx-vue-foreground, #111827);
	border-left: 1px solid var(--pptx-vue-border, #e5e7eb);
	box-shadow: -8px 0 32px rgba(0, 0, 0, 0.25);
}

.pptx-vue-compare-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 16px;
	border-bottom: 1px solid var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-compare-title {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
}

.pptx-vue-compare-summary {
	margin: 2px 0 0;
	font-size: 11px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-compare-close {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	padding: 0;
	font-size: 18px;
	line-height: 1;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	background: transparent;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-compare-actions {
	padding: 8px 16px;
	border-bottom: 1px solid var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-compare-accept-all {
	display: inline-flex;
	align-items: center;
	padding: 6px 12px;
	font-size: 12px;
	color: #f0fdf4;
	background: #15803d;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-compare-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	flex: 1;
	overflow-y: auto;
	padding: 12px;
}

.pptx-vue-compare-empty {
	margin: 0;
	padding: 32px 0;
	text-align: center;
	font-size: 12px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}
</style>
