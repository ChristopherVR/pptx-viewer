<script lang="ts">
	/**
	 * AiFocusBar: the strip under the panel header showing the assistant's current
	 * focused targets as chips (live from the canvas selection, pinned, or picked).
	 *
	 * It hosts the explicit "Point at a slide element" affordance: a crosshair
	 * button that enters PICK MODE, after which the user clicks element(s) on the
	 * canvas to hand them to the assistant (each pick is highlighted on the slide).
	 * A one-click "Merge selected tables" directive still surfaces when the focus
	 * is exactly two tables.
	 */
	import Crosshair from '@lucide/svelte/icons/crosshair';
	import GitMerge from '@lucide/svelte/icons/git-merge';
	import Pin from '@lucide/svelte/icons/pin';
	import PinOff from '@lucide/svelte/icons/pin-off';
	import X from '@lucide/svelte/icons/x';
	import type { PptxSlide } from 'pptx-viewer-core';
	import type { PptxAiFocusedTarget } from 'pptx-viewer-shared/ai';

	import { useTranslator } from '../../../i18n/context';
	import {
		focusTargetChips,
		isTwoTableFocus,
		mergeTablesDirective,
	} from 'pptx-viewer-shared/ai';

	const {
		targets,
		slides,
		isPinned,
		hasPicks,
		pickMode,
		onpin,
		onclearpin,
		onsenddirective,
		onstartpick,
		onstoppick,
		onclearpicks,
	}: {
		targets: readonly PptxAiFocusedTarget[];
		slides: readonly PptxSlide[];
		isPinned: boolean;
		hasPicks: boolean;
		pickMode: boolean;
		onpin: () => void;
		onclearpin: () => void;
		onsenddirective: (text: string) => void;
		onstartpick: () => void;
		onstoppick: () => void;
		onclearpicks: () => void;
	} = $props();

	const t = useTranslator();

	const chips = $derived(focusTargetChips(targets, slides));
	const twoTables = $derived(isTwoTableFocus(targets, slides));
</script>

<div class="pptx-svelte-ai-focus">
	<div class="pptx-svelte-ai-focus-row">
		<span class="pptx-svelte-ai-focus-scope">{t('pptx.ai.focusScope')}</span>
		{#each chips as chip (chip.key)}
			<span class="pptx-svelte-ai-focus-chip" class:is-active={hasPicks || isPinned} title={chip.title}>
				<span class="pptx-svelte-ai-focus-chip-label">{chip.label}</span>
			</span>
		{/each}
		{#if isPinned}
			<span class="pptx-svelte-ai-focus-pinned">{t('pptx.ai.pinnedFocus')}</span>
		{/if}
		<div class="pptx-svelte-ai-focus-actions">
			{#if twoTables}
				<button
					type="button"
					class="pptx-svelte-ai-focus-merge"
					onclick={() => onsenddirective(mergeTablesDirective(twoTables.slideIndex, twoTables.elementIdA, twoTables.elementIdB))}
				>
					<GitMerge size={12} aria-hidden="true" />
					{t('pptx.ai.mergeSelectedTables')}
				</button>
			{/if}
			<button
				type="button"
				class="pptx-svelte-ai-focus-btn"
				class:is-active={pickMode}
				onclick={pickMode ? onstoppick : onstartpick}
				title={t('pptx.ai.pickElement')}
				aria-label={t('pptx.ai.pickAria')}
				aria-pressed={pickMode}
			>
				<Crosshair size={14} aria-hidden="true" />
			</button>
			{#if hasPicks}
				<button
					type="button"
					class="pptx-svelte-ai-focus-btn"
					onclick={onclearpicks}
					title={t('pptx.ai.pickClear')}
					aria-label={t('pptx.ai.pickClear')}
				>
					<X size={14} aria-hidden="true" />
				</button>
			{:else}
				<button
					type="button"
					class="pptx-svelte-ai-focus-btn"
					onclick={isPinned ? onclearpin : onpin}
					title={isPinned ? t('pptx.ai.clearFocus') : t('pptx.ai.pinFocus')}
					aria-label={isPinned ? t('pptx.ai.clearFocus') : t('pptx.ai.pinFocus')}
				>
					{#if isPinned}<PinOff size={14} aria-hidden="true" />{:else}<Pin size={14} aria-hidden="true" />{/if}
				</button>
			{/if}
		</div>
	</div>
	{#if pickMode}
		<div class="pptx-svelte-ai-focus-hint">
			<Crosshair size={14} class="pptx-svelte-ai-focus-hint-ic" aria-hidden="true" />
			<span>{t('pptx.ai.pickElementHint')}</span>
			<button type="button" class="pptx-svelte-ai-focus-done" onclick={onstoppick}>{t('pptx.ai.pickDone')}</button>
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-ai-focus {
		border-bottom: 1px solid var(--pptx-border, #33334d);
		background: color-mix(in srgb, var(--pptx-secondary, #2a2a3d) 30%, transparent);
	}

	.pptx-svelte-ai-focus-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
	}

	.pptx-svelte-ai-focus-scope {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ai-focus-chip {
		display: inline-flex;
		align-items: center;
		max-width: 10rem;
		padding: 1px 8px;
		border-radius: 999px;
		background: var(--pptx-muted, #2a2a3d);
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	.pptx-svelte-ai-focus-chip.is-active {
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent);
		color: var(--pptx-primary, #a5b4fc);
	}

	.pptx-svelte-ai-focus-chip-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-ai-focus-pinned {
		padding: 1px 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent);
		color: var(--pptx-primary, #a5b4fc);
		font-size: 10px;
		font-weight: 500;
	}

	.pptx-svelte-ai-focus-actions {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
	}

	.pptx-svelte-ai-focus-merge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 6px;
		border: none;
		border-radius: 3px;
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 90%, transparent);
		color: var(--pptx-primary-foreground, #fff);
		font: inherit;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
	}

	.pptx-svelte-ai-focus-merge:hover {
		background: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-ai-focus-btn {
		display: inline-flex;
		padding: 4px;
		border: none;
		border-radius: 3px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
	}

	.pptx-svelte-ai-focus-btn:hover {
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-ai-focus-btn.is-active {
		background: var(--pptx-primary, #6366f1);
		color: var(--pptx-primary-foreground, #fff);
	}

	.pptx-svelte-ai-focus-hint {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 10px;
		border-top: 1px solid color-mix(in srgb, var(--pptx-primary, #6366f1) 20%, transparent);
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 6%, transparent);
		font-size: 11px;
		font-weight: 500;
		color: var(--pptx-primary, #a5b4fc);
	}

	:global(.pptx-svelte-ai-focus-hint-ic) {
		flex-shrink: 0;
		animation: pptx-svelte-ai-focus-pulse 1.4s ease-in-out infinite;
	}

	.pptx-svelte-ai-focus-done {
		margin-left: auto;
		padding: 2px 8px;
		border: none;
		border-radius: 3px;
		background: var(--pptx-primary, #6366f1);
		color: var(--pptx-primary-foreground, #fff);
		font: inherit;
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
	}

	@keyframes pptx-svelte-ai-focus-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
