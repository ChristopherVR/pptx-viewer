<script lang="ts">
	/**
	 * RibbonCommand: one big (or `compact`) command button inside a ribbon
	 * group, the Svelte twin of React's `PowerPointRibbonControls.RibbonCommand`.
	 *
	 * The label is rendered as visible text and deliberately NOT duplicated into
	 * an `aria-label`: an `aria-label` would win over the visible text and make
	 * the accessible name diverge from what the user reads, which is precisely
	 * the drift `e2e/ribbon-control-inventory.spec.ts` diffs the bindings on.
	 * The tooltip carries the longer explanation instead.
	 */
	import type { Snippet } from 'svelte';

	const {
		label,
		title,
		icon,
		compact = false,
		disabled = false,
		active = false,
		testid,
		onclick,
	}: {
		label: string;
		/** Tooltip; falls back to the label, matching React. */
		title?: string;
		icon?: Snippet;
		compact?: boolean;
		disabled?: boolean;
		active?: boolean;
		/** `data-testid`, for the few commands the e2e contract addresses by hook. */
		testid?: string;
		onclick?: () => void;
	} = $props();
</script>

<button
	type="button"
	class="pptx-svelte-rbcmd"
	class:pptx-svelte-rbcmd-compact={compact}
	class:pptx-svelte-rbcmd-active={active}
	{disabled}
	title={title ?? label}
	data-testid={testid}
	data-active={testid ? String(active) : undefined}
	aria-pressed={active ? true : undefined}
	onclick={() => onclick?.()}
>
	<span class="pptx-svelte-rbcmd-icon" aria-hidden="true">{#if icon}{@render icon()}{/if}</span>
	<span>{label}</span>
</button>

<style>
	.pptx-svelte-rbcmd {
		display: inline-flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 2px;
		min-width: 54px;
		max-width: 78px;
		height: 58px;
		padding: 4px 4px 2px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 9px;
		line-height: 11px;
		text-align: center;
	}

	.pptx-svelte-rbcmd-compact {
		flex-direction: row;
		gap: 6px;
		align-items: center;
		justify-content: flex-start;
		min-width: 92px;
		max-width: none;
		height: 20px;
		padding: 0 4px;
		font-size: 10px;
		text-align: left;
	}

	.pptx-svelte-rbcmd:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rbcmd:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-rbcmd-active {
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 18%, transparent);
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-rbcmd-icon {
		display: grid;
		flex: none;
		place-items: center;
		width: 24px;
		height: 24px;
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-rbcmd-compact .pptx-svelte-rbcmd-icon {
		width: 16px;
		height: 16px;
	}

	.pptx-svelte-rbcmd-icon :global(svg) {
		width: 100%;
		height: 100%;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
