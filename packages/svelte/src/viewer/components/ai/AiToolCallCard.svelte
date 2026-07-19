<script lang="ts">
	/**
	 * AiToolCallCard: a subtle, non-technical "activity" row describing one thing
	 * the assistant did, e.g. "Looked at slide 5" / "Merged two tables", with a
	 * friendly icon and a status (Working / Done / Failed). The raw tool name +
	 * arguments are hidden behind an optional, collapsed "Details" disclosure for
	 * power users; no ids are shown by default. Purely presentational.
	 */
	import ChartColumn from '@lucide/svelte/icons/chart-column';
	import Check from '@lucide/svelte/icons/check';
	import Eye from '@lucide/svelte/icons/eye';
	import Film from '@lucide/svelte/icons/film';
	import LayoutTemplate from '@lucide/svelte/icons/layout-template';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Move from '@lucide/svelte/icons/move';
	import Navigation from '@lucide/svelte/icons/navigation';
	import Palette from '@lucide/svelte/icons/palette';
	import Search from '@lucide/svelte/icons/search';
	import Shapes from '@lucide/svelte/icons/shapes';
	import StickyNote from '@lucide/svelte/icons/sticky-note';
	import Table from '@lucide/svelte/icons/table';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Type from '@lucide/svelte/icons/type';
	import Wrench from '@lucide/svelte/icons/wrench';
	import { describeToolActivity, summarizeToolArgs, toolLabel } from 'pptx-viewer-shared/ai';
	import type { RenderableToolPart, ToolActivityIcon } from 'pptx-viewer-shared/ai';
	import type { Component } from 'svelte';

	import { useTranslator } from '../../../i18n/context';

	const { part }: { part: RenderableToolPart } = $props();

	const t = useTranslator();

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

	const failed = $derived(part.state === 'output-error');
	const done = $derived(part.state === 'output-available');
	const running = $derived(!failed && !done);
	const activity = $derived(describeToolActivity(part.toolName, part.input, running ? 'present' : 'past'));
	const Icon = $derived(ICONS[activity.icon] ?? Wrench);
	const rawSummary = $derived(summarizeToolArgs(part.input));
	const statusLabel = $derived(
		failed ? t('pptx.ai.toolFailed') : done ? t('pptx.ai.toolDone') : t('pptx.ai.toolRunning'),
	);
</script>

<div class="pptx-svelte-ai-tool">
	<div class="pptx-svelte-ai-tool-head">
		<Icon size={14} class={failed ? 'pptx-svelte-ai-tool-ic is-error' : 'pptx-svelte-ai-tool-ic'} aria-hidden="true" />
		<span class="pptx-svelte-ai-tool-label" class:is-error={failed}>{activity.label}</span>
		<span class="pptx-svelte-ai-tool-chip" class:is-error={failed} class:is-done={done}>
			{#if running}<LoaderCircle size={11} class="pptx-svelte-ai-spin" aria-hidden="true" />{/if}
			{#if done}<Check size={11} aria-hidden="true" />{/if}
			{#if failed}<TriangleAlert size={11} aria-hidden="true" />{/if}
			{statusLabel}
		</span>
	</div>
	{#if failed && part.errorText}
		<div class="pptx-svelte-ai-tool-error">{part.errorText}</div>
	{/if}
	{#if rawSummary}
		<details class="pptx-svelte-ai-tool-details">
			<summary>{t('pptx.ai.toolDetails')}</summary>
			<div class="pptx-svelte-ai-tool-raw">{toolLabel(part.toolName)}: {rawSummary}</div>
		</details>
	{/if}
</div>

<style>
	.pptx-svelte-ai-tool {
		font-size: 12px;
	}

	.pptx-svelte-ai-tool-head {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	:global(.pptx-svelte-ai-tool-ic) {
		flex-shrink: 0;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	:global(.pptx-svelte-ai-tool-ic.is-error) {
		color: var(--pptx-destructive, #fca5a5);
	}

	.pptx-svelte-ai-tool-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.pptx-svelte-ai-tool-label.is-error {
		color: var(--pptx-destructive, #fca5a5);
	}

	.pptx-svelte-ai-tool-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		padding: 1px 6px;
		border-radius: 3px;
		background: var(--pptx-muted, #2a2a3d);
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
	}

	.pptx-svelte-ai-tool-chip.is-done {
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent);
		color: var(--pptx-primary, #a5b4fc);
	}

	.pptx-svelte-ai-tool-chip.is-error {
		background: color-mix(in srgb, var(--pptx-destructive, #ef4444) 15%, transparent);
		color: var(--pptx-destructive, #fca5a5);
	}

	.pptx-svelte-ai-tool-error {
		margin-top: 4px;
		padding-left: 20px;
		font-size: 11px;
		color: var(--pptx-destructive, #fca5a5);
	}

	.pptx-svelte-ai-tool-details {
		margin-top: 2px;
		padding-left: 20px;
	}

	.pptx-svelte-ai-tool-details summary {
		cursor: pointer;
		list-style: none;
		font-size: 10px;
		color: color-mix(in srgb, var(--pptx-muted-foreground, #94a3b8) 70%, transparent);
	}

	.pptx-svelte-ai-tool-details summary:hover {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-tool-details summary::-webkit-details-marker {
		display: none;
	}

	.pptx-svelte-ai-tool-raw {
		margin-top: 2px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 10px;
		color: color-mix(in srgb, var(--pptx-muted-foreground, #94a3b8) 80%, transparent);
		word-break: break-word;
	}

	:global(.pptx-svelte-ai-spin) {
		animation: pptx-svelte-ai-spin 0.8s linear infinite;
	}

	@keyframes pptx-svelte-ai-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
