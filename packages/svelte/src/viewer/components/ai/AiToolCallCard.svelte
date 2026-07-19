<script lang="ts">
	/**
	 * AiToolCallCard: a compact card describing one tool the assistant invoked,
	 * with a human summary of its arguments and a state chip (running / done /
	 * failed). Purely presentational.
	 */
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Wrench from '@lucide/svelte/icons/wrench';
	import { summarizeToolArgs, toolLabel } from 'pptx-viewer-shared/ai';
	import type { RenderableToolPart } from 'pptx-viewer-shared/ai';

	import { useTranslator } from '../../../i18n/context';

	const { part }: { part: RenderableToolPart } = $props();

	const t = useTranslator();

	const failed = $derived(part.state === 'output-error');
	const done = $derived(part.state === 'output-available');
	const running = $derived(!failed && !done);
	const summary = $derived(summarizeToolArgs(part.input));
	const statusLabel = $derived(
		failed ? t('pptx.ai.toolFailed') : done ? t('pptx.ai.toolDone') : t('pptx.ai.toolRunning'),
	);
</script>

<div class="pptx-svelte-ai-tool" class:is-error={failed}>
	<div class="pptx-svelte-ai-tool-head">
		<Wrench size={13} aria-hidden="true" />
		<span class="pptx-svelte-ai-tool-name">{toolLabel(part.toolName)}</span>
		<span class="pptx-svelte-ai-tool-chip" class:is-error={failed} class:is-done={done}>
			{#if running}<LoaderCircle size={11} class="pptx-svelte-ai-spin" aria-hidden="true" />{/if}
			{#if done}<Check size={11} aria-hidden="true" />{/if}
			{#if failed}<TriangleAlert size={11} aria-hidden="true" />{/if}
			{statusLabel}
		</span>
	</div>
	{#if summary}
		<div class="pptx-svelte-ai-tool-summary" title={summary}>{summary}</div>
	{/if}
	{#if failed && part.errorText}
		<div class="pptx-svelte-ai-tool-error">{part.errorText}</div>
	{/if}
</div>

<style>
	.pptx-svelte-ai-tool {
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: color-mix(in srgb, var(--pptx-muted, #2a2a3d) 40%, transparent);
		padding: 6px 10px;
		font-size: 12px;
	}

	.pptx-svelte-ai-tool.is-error {
		border-color: color-mix(in srgb, var(--pptx-destructive, #ef4444) 50%, transparent);
		background: color-mix(in srgb, var(--pptx-destructive, #ef4444) 8%, transparent);
	}

	.pptx-svelte-ai-tool-head {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-tool-name {
		font-weight: 600;
		color: var(--pptx-card-foreground, #e2e8f0);
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

	.pptx-svelte-ai-tool-summary {
		margin-top: 4px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-ai-tool-error {
		margin-top: 4px;
		font-size: 11px;
		color: var(--pptx-destructive, #fca5a5);
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
