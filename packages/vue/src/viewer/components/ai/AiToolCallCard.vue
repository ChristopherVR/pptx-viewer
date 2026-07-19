<script setup lang="ts">
/**
 * AiToolCallCard: a compact card describing one tool the assistant invoked,
 * with a human summary of its arguments and a state chip (running / done /
 * failed). Purely presentational.
 */
import { Check, LoaderCircle, TriangleAlert, Wrench } from 'lucide-vue-next';
import type { RenderableToolPart } from 'pptx-viewer-shared/ai';
import { summarizeToolArgs, toolLabel } from 'pptx-viewer-shared/ai';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';

const props = defineProps<{ part: RenderableToolPart }>();
const { t } = useI18n();

const failed = computed(() => props.part.state === 'output-error');
const done = computed(() => props.part.state === 'output-available');
const running = computed(() => !failed.value && !done.value);
const summary = computed(() => summarizeToolArgs(props.part.input));
const statusLabel = computed(() =>
	failed.value
		? t('pptx.ai.toolFailed')
		: done.value
			? t('pptx.ai.toolDone')
			: t('pptx.ai.toolRunning'),
);
</script>

<template>
	<div
		:class="
			cn(
				'rounded-md border px-2.5 py-1.5 text-[12px]',
				failed ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-secondary/40',
			)
		"
	>
		<div class="flex items-center gap-1.5">
			<Wrench class="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
			<span class="font-medium text-foreground">{{ toolLabel(props.part.toolName) }}</span>
			<span
				:class="
					cn(
						'ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px]',
						failed
							? 'bg-destructive/15 text-destructive'
							: done
								? 'bg-primary/15 text-primary'
								: 'bg-muted text-muted-foreground',
					)
				"
			>
				<LoaderCircle v-if="running" class="w-3 h-3 animate-spin" />
				<Check v-else-if="done" class="w-3 h-3" />
				<TriangleAlert v-else class="w-3 h-3" />
				{{ statusLabel }}
			</span>
		</div>
		<div
			v-if="summary"
			class="mt-1 truncate font-mono text-[11px] text-muted-foreground"
			:title="summary"
		>
			{{ summary }}
		</div>
		<div v-if="failed && props.part.errorText" class="mt-1 text-[11px] text-destructive">
			{{ props.part.errorText }}
		</div>
	</div>
</template>
