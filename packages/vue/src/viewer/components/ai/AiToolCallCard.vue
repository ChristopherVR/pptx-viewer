<script setup lang="ts">
/**
 * AiToolCallCard: a subtle, non-technical "activity" row describing one thing
 * the assistant did, e.g. "Looked at slide 5" / "Merged two tables", with a
 * friendly icon and a status (working / done / failed). The raw tool name +
 * arguments are hidden behind an optional, collapsed "Details" disclosure for
 * power users. Purely presentational.
 */
import {
	ChartColumn,
	Check,
	Eye,
	Film,
	LayoutTemplate,
	LoaderCircle,
	Move,
	Navigation,
	Palette,
	Search,
	Shapes,
	StickyNote,
	Table,
	Trash2,
	TriangleAlert,
	Type,
	Wrench,
} from 'lucide-vue-next';
import type { RenderableToolPart, ToolActivityIcon } from 'pptx-viewer-shared/ai';
import { describeToolActivity, summarizeToolArgs, toolLabel } from 'pptx-viewer-shared/ai';
import type { Component } from 'vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';

const props = defineProps<{ part: RenderableToolPart }>();
const { t } = useI18n();

/** Map a shared icon category to a concrete lucide glyph. */
const ICONS: Record<ToolActivityIcon, Component> = {
	view: Eye,
	text: Type,
	shape: Shapes,
	theme: Palette,
	table: Table,
	slide: LayoutTemplate,
	chart: ChartColumn,
	move: Move,
	delete: Trash2,
	search: Search,
	nav: Navigation,
	animation: Film,
	notes: StickyNote,
	tool: Wrench,
};

const failed = computed(() => props.part.state === 'output-error');
const done = computed(() => props.part.state === 'output-available');
const running = computed(() => !failed.value && !done.value);

const activity = computed(() =>
	describeToolActivity(props.part.toolName, props.part.input, running.value ? 'present' : 'past'),
);
const icon = computed<Component>(() => ICONS[activity.value.icon] ?? Wrench);
const rawSummary = computed(() => summarizeToolArgs(props.part.input));
const statusLabel = computed(() =>
	failed.value
		? t('pptx.ai.toolFailed')
		: done.value
			? t('pptx.ai.toolDone')
			: t('pptx.ai.toolRunning'),
);
</script>

<template>
	<div class="text-[12px]">
		<div class="flex items-center gap-1.5">
			<component
				:is="icon"
				:class="cn('w-3.5 h-3.5 shrink-0', failed ? 'text-destructive' : 'text-muted-foreground')"
			/>
			<span :class="cn('truncate', failed ? 'text-destructive' : 'text-foreground')">
				{{ activity.label }}
			</span>
			<span
				:class="
					cn(
						'ml-auto inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px]',
						failed
							? 'bg-destructive/15 text-destructive'
							: done
								? 'bg-primary/10 text-primary'
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
		<div v-if="failed && props.part.errorText" class="mt-1 pl-5 text-[11px] text-destructive">
			{{ props.part.errorText }}
		</div>
		<details v-if="rawSummary" class="group mt-0.5 pl-5">
			<summary
				class="cursor-pointer list-none text-[10px] text-muted-foreground/70 hover:text-muted-foreground"
			>
				{{ t('pptx.ai.toolDetails') }}
			</summary>
			<div class="mt-0.5 break-words font-mono text-[10px] text-muted-foreground/80">
				{{ toolLabel(props.part.toolName) }}: {{ rawSummary }}
			</div>
		</details>
	</div>
</template>
