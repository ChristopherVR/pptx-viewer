<script lang="ts">
	/**
	 * RibbonGroup: one labelled column of a PowerPoint ribbon tab, the Svelte
	 * twin of React's `PowerPointRibbonControls.RibbonGroup`.
	 *
	 * The caption is a non-interactive `<span>` pinned to the bottom edge, not a
	 * legend or a heading, so it never shows up as a control in the
	 * cross-binding ribbon inventory; the group's own name is carried by
	 * `aria-label` on the section instead.
	 */
	import type { Snippet } from 'svelte';

	const { label, children }: { label: string; children: Snippet } = $props();
</script>

<section class="pptx-svelte-rbgroup" aria-label={label}>
	<div class="pptx-svelte-rbgroup-row">{@render children()}</div>
	<span class="pptx-svelte-rbgroup-label">{label}</span>
</section>

<style>
	.pptx-svelte-rbgroup {
		position: relative;
		display: flex;
		flex: none;
		flex-direction: column;
		justify-content: space-between;
		min-height: 78px;
		padding: 2px 8px 2px;
		border-right: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent);
	}

	.pptx-svelte-rbgroup:last-child {
		border-right: 0;
	}

	.pptx-svelte-rbgroup-row {
		display: flex;
		align-items: flex-start;
		gap: 4px;
	}

	.pptx-svelte-rbgroup-label {
		padding-top: 2px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 9px;
		line-height: 12px;
		text-align: center;
		white-space: nowrap;
	}
</style>
