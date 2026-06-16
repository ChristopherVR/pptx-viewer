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
	<aside
		v-if="open && compareResult"
		class="pptx-vue-compare-panel fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-[100vw] flex-col border-l border-border bg-popover text-foreground shadow-2xl backdrop-blur-lg"
	>
		<header
			class="pptx-vue-compare-header flex items-start justify-between gap-3 border-b border-border px-4 py-3"
		>
			<div>
				<h3 class="pptx-vue-compare-title m-0 text-sm font-medium text-foreground">
					Compare versions
				</h3>
				<p class="pptx-vue-compare-summary mt-0.5 text-[11px] text-muted-foreground">
					{{ compareResult.addedCount }} added · {{ compareResult.removedCount }} removed ·
					{{ compareResult.changedCount }} changed
				</p>
			</div>
			<button
				type="button"
				class="pptx-vue-compare-close inline-flex h-6 w-6 items-center justify-center rounded p-0 text-lg leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Close"
				@click="emit('close')"
			>
				&times;
			</button>
		</header>

		<div
			v-if="nonTrivialCount > 0"
			class="pptx-vue-compare-actions border-b border-border/60 px-4 py-2"
		>
			<button
				type="button"
				class="pptx-vue-compare-accept-all inline-flex cursor-pointer items-center gap-1.5 rounded bg-green-700/80 px-3 py-1.5 text-xs text-green-50 transition-colors hover:bg-green-600"
				@click="handleAcceptAll"
			>
				Accept all
			</button>
		</div>

		<div class="pptx-vue-compare-list flex flex-1 flex-col gap-2 overflow-y-auto p-3">
			<p
				v-if="nonTrivialCount === 0"
				class="pptx-vue-compare-empty m-0 py-8 text-center text-xs text-muted-foreground"
			>
				No differences
			</p>
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
