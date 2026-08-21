<script lang="ts">
	/**
	 * GroupInfoSection: read-only child-count summary for a selected group, at
	 * parity with React's `ElementMiscPanels.tsx` GroupInfoPanel.
	 */
	import type { GroupPptxElement, PptxElement } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';

	const { el }: { el: PptxElement } = $props();
	const t = useTranslator();

	const group = $derived(el as GroupPptxElement);
	const childCount = $derived(Array.isArray(group.children) ? group.children.length : undefined);
</script>

<div class="pptx-svelte-group-info">
	{childCount !== undefined
		? t('pptx.group.childCount', { count: childCount })
		: t('pptx.group.groupedElement')}
</div>

<style>
	.pptx-svelte-group-info {
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
