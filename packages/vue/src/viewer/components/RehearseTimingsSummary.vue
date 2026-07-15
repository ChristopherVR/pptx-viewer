<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatRehearseMs } from '../composables/useRehearseTimings';

const props = defineProps<{ timings: Record<number, number> }>();
const emit = defineEmits<{ (event: 'save' | 'discard'): void }>();
const { t } = useI18n();
const entries = computed(() =>
	Object.entries(props.timings)
		.map(([index, ms]) => ({ index: Number(index), ms }))
		.sort((a, b) => a.index - b.index),
);
const total = computed(() => entries.value.reduce((sum, entry) => sum + entry.ms, 0));
</script>

<template>
	<div
		class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm"
	>
		<section
			class="w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
			role="dialog"
			aria-modal="true"
			:aria-label="t('pptx.rehearse.summaryTitle')"
		>
			<header class="border-b border-border px-5 py-4">
				<h2 class="m-0 text-base font-semibold">{{ t('pptx.rehearse.summaryTitle') }}</h2>
				<p class="mb-0 mt-1 text-sm text-muted-foreground">
					{{ t('pptx.rehearse.totalPresentationTime') }}:
					<span class="font-mono text-foreground">{{ formatRehearseMs(total) }}</span>
				</p>
			</header>
			<div class="max-h-72 overflow-y-auto px-5 py-3">
				<div
					v-for="entry in entries"
					:key="entry.index"
					class="flex items-center justify-between border-b border-border/60 py-2 text-sm"
				>
					<span>{{ t('pptx.rehearse.slide') }} {{ entry.index + 1 }}</span>
					<span class="font-mono tabular-nums">{{ formatRehearseMs(entry.ms) }}</span>
				</div>
			</div>
			<footer class="flex justify-end gap-2 border-t border-border px-5 py-3">
				<button
					type="button"
					class="rounded px-4 py-2 text-sm hover:bg-muted"
					@click="emit('discard')"
				>
					{{ t('pptx.rehearse.discard') }}
				</button>
				<button
					type="button"
					class="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
					@click="emit('save')"
				>
					{{ t('pptx.rehearse.saveTimings') }}
				</button>
			</footer>
		</section>
	</div>
</template>
