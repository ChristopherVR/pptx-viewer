<script lang="ts">
	/**
	 * RibbonCommandStack: the two- or three-row column PowerPoint uses to pack
	 * secondary commands beside a full-height one. React's
	 * `PowerPointRibbonControls.RibbonCommandStack` in Svelte form.
	 */
	import type { Snippet } from 'svelte';

	const { children }: { children: Snippet } = $props();
</script>

<div class="pptx-svelte-rbstack">{@render children()}</div>

<style>
	.pptx-svelte-rbstack {
		display: flex;
		flex: none;
		flex-direction: column;
		justify-content: flex-start;
		gap: 2px;
	}
</style>
