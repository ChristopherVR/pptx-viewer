<script lang="ts">
	/**
	 * ContextualTab: the body of a selection-driven tab (Shape Format, Picture
	 * Format, Table Design, Chart Design, SmartArt Design). Which groups it
	 * shows, and which galleries sit in them in which mode, is shared's
	 * `CONTEXTUAL_TAB_GROUPS`; this file only maps that list onto ribbon groups.
	 */
	import { CONTEXTUAL_TAB_GROUPS } from 'pptx-viewer-shared';
	import type { RibbonContextualTabId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import RibbonGroup from '../RibbonGroup.svelte';
	import RibbonGallery from './RibbonGallery.svelte';
	import { translatedOr } from './gallery-labels';

	const { tab }: { tab: RibbonContextualTabId } = $props();
	const t = useTranslator();
	const groups = $derived(CONTEXTUAL_TAB_GROUPS[tab]);
</script>

<div class="pptx-svelte-ctxtab" data-ribbon-contextual-panel={tab}>
	{#each groups as group (group.group)}
		<RibbonGroup label={translatedOr(t, group.labelKey, group.label)} group={group.group}>
			{#each group.galleries as placement (placement.control)}
				<RibbonGallery {placement} />
			{/each}
		</RibbonGroup>
	{/each}
</div>

<style>
	.pptx-svelte-ctxtab {
		display: flex;
		align-items: stretch;
		flex-wrap: nowrap;
	}
</style>
