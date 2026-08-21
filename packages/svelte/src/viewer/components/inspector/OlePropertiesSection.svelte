<script lang="ts">
	/**
	 * OlePropertiesSection: read-only OLE object summary (type / file name /
	 * link status), at parity with React's `ElementMiscPanels.tsx`
	 * OlePropertiesPanel.
	 */
	import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
	import { getOleObjectTypeLabel } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';

	const { el }: { el: PptxElement } = $props();
	const t = useTranslator();

	const ole = $derived(el as OlePptxElement);
</script>

<div class="pptx-svelte-ole-info">
	<div class="pptx-svelte-ole-row">
		<span>{t('pptx.ole.type')}</span>
		<span class="pptx-svelte-ole-value">{getOleObjectTypeLabel(ole.oleObjectType)}</span>
	</div>
	{#if ole.fileName}
		<div class="pptx-svelte-ole-row">
			<span>{t('pptx.ole.fileName')}</span>
			<span class="pptx-svelte-ole-value" title={ole.fileName}>{ole.fileName}</span>
		</div>
	{/if}
	<div class="pptx-svelte-ole-row">
		<span>{t('pptx.ole.linkStatus')}</span>
		<span class="pptx-svelte-ole-badge" class:is-linked={ole.isLinked}>
			{ole.isLinked ? t('pptx.ole.linked') : t('pptx.ole.embedded')}
		</span>
	</div>
</div>

<style>
	.pptx-svelte-ole-info {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 11px;
	}
	.pptx-svelte-ole-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.pptx-svelte-ole-row > span:first-child {
		color: var(--pptx-muted-foreground, #94a3b8);
	}
	.pptx-svelte-ole-value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pptx-svelte-ole-badge {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		padding: 1px 8px;
		font-size: 10px;
		font-weight: 500;
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
	}
	.pptx-svelte-ole-badge.is-linked {
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
	}
</style>
