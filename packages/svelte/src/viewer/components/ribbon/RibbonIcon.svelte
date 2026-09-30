<script lang="ts">
	import { RIBBON_CONTROL_ICONS } from 'pptx-viewer-shared';

	const { name, slot: iconSlot }: { name: string; slot?: string } = $props();
	const artwork = $derived(RIBBON_CONTROL_ICONS[name]);
</script>

{#if artwork}
	<svg {...artwork.attrs} {...(iconSlot ? { slot: iconSlot } : {})} width="16" height="16" aria-hidden="true">
		{#each artwork.children as node}
			<svelte:element this={node.tag} {...node.attrs}>{node.text ?? ''}</svelte:element>
		{/each}
	</svg>
{/if}
